/**
 * 스킬 전투 계산 — 모션 혼합분포 → 시전 데미지 분포 → N방컷/DPM.
 * (docs/nhit-dpm.md §2~8)
 *
 * 순수 계산부: 이미 산출된 스탯/공격력/버프 배율을 입력받아 분포를 만든다.
 * (스킬 선택·버프 합산은 앱 레이어가 조립)
 */

import type { DamageRange } from './attackPower'
import { physRange, calcMagic } from './attackPower'
import { WEAPON_CONSTANTS } from './weapons'
import type { WeaponType } from './weapons'
import type { ElementReaction } from './damage'
import { ELEMENT_MULT, DAMAGE_CAP } from './damage'
import type { Dist } from './nhitProb'
import { uniformDist, mixtureDist, convolve, expectedValue, exactNProbabilities } from './nhitProb'
import { lineSlots, critSlots } from './rngCycle'

// ── 모션 규칙 ────────────────────────────────────────────
export type MotionRule =
  | { kind: 'general' } // 2:3 혼합(폴암 5:5)
  | { kind: 'swing' } // 항상 constMax
  | { kind: 'stab' } // 항상 constMin
  | { kind: 'fixed'; mult: number } // 로어 4.0
  | { kind: 'brandish' } // 2타: 찌1 + 베1
  | { kind: 'unsupported' }

/** skill id → 모션 규칙 (그 외는 general). docs §2.3 */
export const SKILL_MOTION: Record<number, MotionRule> = {
  1121008: { kind: 'brandish' }, // 브랜디쉬(히어로)
  11111004: { kind: 'brandish' }, // 브랜디쉬(소울마스터)
  1311001: { kind: 'stab' }, // 스피어 버스터
  1311002: { kind: 'stab' }, // 폴암 버스터
  1311003: { kind: 'swing' }, // 드래곤 쓰레셔:창
  1311004: { kind: 'swing' }, // 드래곤 쓰레셔:폴암
  1311006: { kind: 'fixed', mult: 4.0 }, // 드래곤 로어
}

/** 모션차가 있는 무기(constMin≠constMax) 여부 */
function hasMotion(wt: WeaponType): boolean {
  const wc = WEAPON_CONSTANTS[wt]
  return wc.constMin !== wc.constMax
}

/** 일반 스킬의 찌르기:베기 확률 (창/도끼/둔기 2:3, 폴암 5:5) */
function generalMix(wt: WeaponType): { stab: number; swing: number } {
  if (wt === 'polearm') return { stab: 0.5, swing: 0.5 }
  return { stab: 0.4, swing: 0.6 }
}

/** 한 라인의 무기배수 성분들 [{weight, mult}] */
export interface MotionComponent {
  weight: number
  mult: number
}

/**
 * 스킬의 라인별 모션 성분. 반환 = 라인 배열, 각 라인 = 성분 배열.
 * null = 미지원(파이널어택 등).
 */
export function skillMotionLines(
  skillId: number,
  weaponType: WeaponType,
  attackCount: number,
): MotionComponent[][] | null {
  const wc = WEAPON_CONSTANTS[weaponType]
  const rule = SKILL_MOTION[skillId] ?? { kind: 'general' as const }
  if (rule.kind === 'unsupported') return null

  const stabC = wc.constMin
  const swingC = wc.constMax
  const one = (mult: number): MotionComponent[] => [{ weight: 1, mult }]

  const lines = Math.max(1, attackCount || 1)

  switch (rule.kind) {
    case 'brandish':
      // 2타: 찌르기1 + 베기1 (결정론)
      return [one(stabC), one(swingC)]
    case 'swing':
      return Array.from({ length: lines }, () => one(swingC))
    case 'stab':
      return Array.from({ length: lines }, () => one(stabC))
    case 'fixed':
      return Array.from({ length: lines }, () => one(rule.mult))
    case 'general':
    default: {
      if (!hasMotion(weaponType)) return Array.from({ length: lines }, () => one(stabC))
      const { stab, swing } = generalMix(weaponType)
      const comp: MotionComponent[] = [
        { weight: stab, mult: stabC },
        { weight: swing, mult: swingC },
      ]
      return Array.from({ length: lines }, () => comp)
    }
  }
}

// ── 데미지 파이프라인 (endpoint-wise, 분포용) ─────────────
const clampFloor = (x: number): number => Math.floor(Math.min(DAMAGE_CAP, Math.max(1, x)))

export interface LineDamageInput {
  /** 기본 데미지 범위(모션/마법식 결과) */
  base: DamageRange
  /** 속성 최종배율 (차지/리셋 반영, 기본은 ELEMENT_MULT[reaction]) */
  elementMult: number
  /** 방어: 물리/마법, def, 렙차 D. 없으면 미적용 */
  defense?: { kind: 'physical' | 'magic'; def: number; levelPenalty: number; ignore?: boolean }
  /** 스킬 퍼뎀 % (5단계, 방어 뒤) */
  skillPercent: number
  /**
   * 데미지 증가 배수(2단계 Modifiers) — 콤보·버서크·차지 계수·위협·쉐파·엘앰프 등 전부.
   * 원소와 함께 방어 차감 전에 적용한다. (기본 1)
   */
  damageMult: number
  /** 크리 기대배율 f = 1 + 크리확률×크리추뎀/100 (기본 1) */
  critFactor: number
  /**
   * 7단계 애프터 모디파이어 — 타수별 배율. 클램프(199999) **이후** 곱하므로 상한 초과 가능.
   * 예: 피스트 5타 ×2, 6타 ×4. 기본 1.
   */
  postClampMult?: number
}

/** 한 라인의 최종 데미지 범위 (clamp 포함) */
export function lineFinalRange(p: LineDamageInput): DamageRange {
  const apply = (d: number, defCoef: number): number => {
    // 2단계 Modifiers(원소 반응 + 모든 데미지증가 배수)를 방어 차감 전에 적용
    let v = d * p.elementMult * p.damageMult
    if (p.defense && !p.defense.ignore) {
      if (p.defense.kind === 'physical') v = v * (1 - 0.01 * p.defense.levelPenalty) - p.defense.def * defCoef
      else v = v - p.defense.def * defCoef * (1 + 0.01 * p.defense.levelPenalty)
    }
    // 5·6단계: 스킬 계수 + 크리 (방어 뒤)
    v = (v * p.skillPercent) / 100
    v = v * p.critFactor
    // 7단계 애프터 모디파이어: 클램프 후 타수배율(상한 초과 가능) → 8단계 floor
    const clamped = clampFloor(v)
    const pm = p.postClampMult ?? 1
    return pm === 1 ? clamped : Math.floor(clamped * pm)
  }
  // max는 0.5, min은 0.6 계수 (기존 physicalVsMonster 규칙)
  return { min: apply(p.base.min, 0.6), max: apply(p.base.max, 0.5) }
}

// ── 시전 분포 조립 ──────────────────────────────────────
export interface CastDamageParams {
  weaponType: WeaponType
  skillId: number
  attackCount: number
  /** 물리: 주/부스탯·총공격력·숙련도 / 마법: 총마력·INT·spellAtk(mad) */
  kind: 'physical' | 'magic'
  primary?: number
  secondary?: number
  watk?: number
  mastery?: number
  magic?: number
  int?: number
  spellAtk?: number
  elementMult: number
  defense?: LineDamageInput['defense']
  skillPercent: number
  /** 데미지 증가 배수(콤보·버서크·차지 계수·위협·쉐파·엘앰프 등). 방어 앞 적용 */
  damageMult: number
  /** 크리 확률 (0~1). 크리는 평균배율이 아니라 확률 혼합으로 분포에 반영 */
  critProb: number
  /** 크리 시 데미지 배율 (예: 1.4). critProb>0일 때만 사용 */
  critMult: number
  /**
   * 타당 고정 base(모션 무관) — 럭세/트스 등 예외식 스킬용.
   * 지정 시 무기 모션식(physRange) 대신 이 범위를 attackCount만큼의 라인으로 사용한다.
   */
  lineBase?: DamageRange
  /**
   * 7단계 타수별 배율(라인 인덱스별). 예: 피스트 [1,1,1,1,2,4].
   * 지정한 인덱스만 클램프 후 배율 적용, 없으면 1.
   */
  hitMultipliers?: number[]
}

export interface CastResult {
  dist: Dist
  /** 시전 전체(모든 라인 합) 데미지 범위 */
  totalRange: DamageRange
  /** 라인별 데미지 범위 */
  lineRanges: DamageRange[]
}

// ── 라인 스펙 ──────────────────────────────────────────
/**
 * 라인 하나의 최종 스펙. 난수 순환에서는 크리 판정 난수가 다른 라인과 공유될 수 있어
 * 크리를 미리 섞어 버리면 안 된다. 모션 성분별로 논크리·크리 범위를 모두 보존한다.
 */
interface LineSpec {
  motions: { weight: number; normal: DamageRange; crit: DamageRange }[]
}

/** 시전 분포의 목표 bin 수. 모든 성분이 같은 격자를 쓰도록 한 번만 정한다. */
const TARGET_CAST_BINS = 600

/** 라인의 전체 범위 (모션·크리 전부 포함) */
function specRange(s: LineSpec): DamageRange {
  let min = Infinity
  let max = -Infinity
  for (const m of s.motions) {
    min = Math.min(min, m.normal.min, m.crit.min)
    max = Math.max(max, m.normal.max, m.crit.max)
  }
  return { min, max }
}

/**
 * 같은 데미지 슬롯을 읽는 라인들의 합 분포.
 * 같은 슬롯 = 같은 난수이므로 이 라인들의 데미지는 완전상관이고,
 * 합은 범위를 더한 단일 균등분포가 된다(모션 조합마다 하나씩).
 *
 * @param lowHalf 이 슬롯이 크리 판정에도 쓰이면 u가 [0,p) 또는 [p,1)로 잘린다. undefined면 제한 없음.
 */
function groupDist(
  lineIdx: number[],
  specs: LineSpec[],
  isCrit: (line: number) => boolean,
  lowHalf: boolean | undefined,
  critProb: number,
  step: number,
): Dist {
  let combos: { weight: number; min: number; max: number }[] = [{ weight: 1, min: 0, max: 0 }]
  for (const i of lineIdx) {
    const useCrit = isCrit(i)
    const next: typeof combos = []
    for (const c of combos) {
      for (const m of specs[i].motions) {
        const r = useCrit ? m.crit : m.normal
        next.push({ weight: c.weight * m.weight, min: c.min + r.min, max: c.max + r.max })
      }
    }
    combos = next
  }
  const parts = combos
    .filter((c) => c.weight > 0)
    .map(({ weight, min, max }) => {
      const cut = min + critProb * (max - min)
      const lo = lowHalf === false ? cut : min
      const hi = lowHalf === true ? cut : max
      return { weight, dist: uniformDist(lo, hi, step) }
    })
  return mixtureDist(parts)
}

/**
 * 라인 스펙들을 난수 순환에 따라 합성해 시전 1회 분포를 만든다.
 *
 * 크리 판정에 쓰이는 슬롯마다 u < critProb(크리) / u ≥ critProb(논크리)로 갈래를 나눈다.
 * 갈래 하나를 고정하면 모든 라인의 크리 여부가 정해지고, 남은 자유도는 데미지 슬롯별로만
 * 묶이므로 그룹끼리는 다시 독립이다 → 기존 컨볼루션을 그대로 쓴다.
 * 전체 = 갈래별 분포의 가중합. 근사가 아니라 정확 계산이다.
 */
function assembleCast(specs: LineSpec[], critProb: number): Dist {
  const slots = lineSlots(specs.length)
  const cs = critSlots(slots)
  const p = Math.max(0, Math.min(1, critProb))

  let tmin = 0
  let tmax = 0
  for (const s of specs) {
    const r = specRange(s)
    tmin += r.min
    tmax += r.max
  }
  const step = Math.max(1, Math.ceil((tmax - tmin) / TARGET_CAST_BINS))

  // 데미지 슬롯 → 그 슬롯을 읽는 라인들 (같은 슬롯이면 데미지가 완전상관)
  const groups = new Map<number, number[]>()
  slots.forEach((s, i) => {
    const g = groups.get(s.dmg)
    if (g) g.push(i)
    else groups.set(s.dmg, [i])
  })

  const parts: { weight: number; dist: Dist }[] = []
  for (let mask = 0; mask < 1 << cs.length; mask++) {
    let weight = 1
    const low = new Map<number, boolean>()
    cs.forEach((slot, k) => {
      const isLow = ((mask >> k) & 1) === 1
      low.set(slot, isLow)
      weight *= isLow ? p : 1 - p
    })
    if (weight <= 0) continue

    const isCrit = (line: number) => low.get(slots[line].crit) === true
    let acc: Dist | null = null
    for (const [dmgSlot, idx] of groups) {
      const g = groupDist(idx, specs, isCrit, low.get(dmgSlot), p, step)
      acc = acc ? convolve(acc, g) : g
    }
    if (acc) parts.push({ weight, dist: acc })
  }
  return mixtureDist(parts)
}

/** 시전(1회) 데미지 분포 + 범위. 미지원 스킬이면 null */
export function computeCast(p: CastDamageParams): CastResult | null {
  const finalOf = (base: DamageRange, critFactor: number, postClampMult = 1) =>
    lineFinalRange({
      base, elementMult: p.elementMult, defense: p.defense, skillPercent: p.skillPercent,
      damageMult: p.damageMult, critFactor, postClampMult,
    })
  const critProb = Math.max(0, Math.min(1, p.critProb))
  // 크리 배율이 1이면 크리와 논크리가 같으므로 갈래를 나눌 필요가 없다
  const hasCrit = critProb > 0 && p.critMult > 1

  /** base 범위 하나를 모션 성분(논크리·크리 범위 쌍)으로 */
  const motionOf = (base: DamageRange, weight: number, postClampMult = 1) => {
    const normal = finalOf(base, 1, postClampMult)
    return { weight, normal, crit: hasCrit ? finalOf(base, p.critMult, postClampMult) : normal }
  }

  const specs: LineSpec[] = []
  const lineRanges: DamageRange[] = []
  const push = (motions: LineSpec['motions']) => {
    const spec: LineSpec = { motions }
    specs.push(spec)
    lineRanges.push(specRange(spec))
  }

  if (p.kind === 'magic') {
    // 마법: 모션 무관 단일 라인
    push([motionOf(calcMagic(p.magic ?? 0, p.int ?? 0, p.spellAtk ?? 0, p.mastery ?? 1), 1)])
  } else if (p.lineBase) {
    // 예외식(럭세/트스): 모션 무관 고정 base를 attackCount 라인으로
    const n = Math.max(1, p.attackCount || 1)
    for (let i = 0; i < n; i++) push([motionOf(p.lineBase, 1, p.hitMultipliers?.[i] ?? 1)])
  } else {
    const lines = skillMotionLines(p.skillId, p.weaponType, p.attackCount)
    if (!lines) return null
    lines.forEach((comps, lineIdx) => {
      const postMult = p.hitMultipliers?.[lineIdx] ?? 1 // 7단계 타수배율(피스트 5타×2·6타×4)
      push(comps.map(({ weight, mult }) => motionOf(
        physRange(p.primary ?? 0, p.secondary ?? 0, mult, p.watk ?? 0, p.mastery ?? 1),
        weight, postMult,
      )))
    })
  }

  const dist = assembleCast(specs, hasCrit ? critProb : 0)
  return {
    dist,
    totalRange: { min: dist.base, max: dist.base + (dist.p.length - 1) * dist.step },
    lineRanges,
  }
}

/** @deprecated computeCast 사용 */
export function computeCastDist(p: CastDamageParams): Dist | null {
  return computeCast(p)?.dist ?? null
}

// ── N방컷 / DPM ─────────────────────────────────────────
export interface NhitResult {
  /** exact[k-1] = 정확히 k방 확률 */
  exact: number[]
  cumulative: number[]
  over: number
  /** 기대 처치 타수(가중평균, over는 maxN+1로 근사) */
  meanHits: number
  /** 추가스킬(prior)만으로 처치될 확률 (0타). prior 없으면 0 */
  zero: number
}

/**
 * N방컷. prior가 주어지면 추가스킬 1회 시전 분포를 시작 누적으로 두고,
 * 그 위에 메인 시전을 N회 더한다(추가스킬 데미지도 분포째 반영).
 */
export function computeNhit(castDist: Dist, hp: number, maxN = 10, prior?: Dist): NhitResult {
  const { exact, cumulative, over, zero } = exactNProbabilities(castDist, hp, maxN, prior)
  const meanHits = exact.reduce((a, x, i) => a + x * (i + 1), 0) + over * (maxN + 1)
  return { exact, cumulative, over, meanHits, zero }
}

/** DPM = 기대 시전 데미지 × 분당 시전수 */
export function computeDpm(castDist: Dist, attacksPerMinute: number): number {
  return expectedValue(castDist) * attacksPerMinute
}

/** 원소 반응 → 기본 배율 (차지/리셋 미적용 시) */
export function baseElementMult(reaction: ElementReaction): number {
  return ELEMENT_MULT[reaction]
}
