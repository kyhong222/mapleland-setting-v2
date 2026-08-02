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
import { uniformDist, mixtureDist, convolve, expectedValue, exactNProbabilities, stepFor } from './nhitProb'

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
    return clampFloor(v)
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
}

export interface CastResult {
  dist: Dist
  /** 시전 전체(모든 라인 합) 데미지 범위 */
  totalRange: DamageRange
  /** 라인별 데미지 범위 */
  lineRanges: DamageRange[]
}

/** 시전(1회) 데미지 분포 + 범위. 미지원 스킬이면 null */
export function computeCast(p: CastDamageParams): CastResult | null {
  const finalOf = (base: DamageRange, critFactor: number) =>
    lineFinalRange({
      base, elementMult: p.elementMult, defense: p.defense, skillPercent: p.skillPercent,
      damageMult: p.damageMult, critFactor,
    })
  const critProb = Math.max(0, Math.min(1, p.critProb))

  /**
   * 한 성분(base 범위)을 크리 확률 혼합으로 전개.
   * 논크리(×1)와 크리(×critMult)를 각각 파이프라인에 통과시켜 분포 성분으로 만든다.
   * (평균배율로 뭉개지 않으므로 데미지 범위=논크리최소~크리최대, 방컷=혼합분포)
   */
  const critParts = (base: DamageRange, weight: number) => {
    const nc = finalOf(base, 1)
    const parts = [{ weight: weight * (1 - critProb), dist: uniformDist(nc.min, nc.max, stepFor(nc.min, nc.max)) }]
    let min = nc.min
    let max = nc.max
    if (critProb > 0) {
      const cr = finalOf(base, p.critMult)
      parts.push({ weight: weight * critProb, dist: uniformDist(cr.min, cr.max, stepFor(cr.min, cr.max)) })
      min = Math.min(min, cr.min)
      max = Math.max(max, cr.max)
    }
    return { parts: parts.filter((x) => x.weight > 0), min, max }
  }

  // 마법: 모션 무관 단일 라인
  if (p.kind === 'magic') {
    const mix = critParts(calcMagic(p.magic ?? 0, p.int ?? 0, p.spellAtk ?? 0, p.mastery ?? 1), 1)
    const fr = { min: mix.min, max: mix.max }
    return { dist: mixtureDist(mix.parts), totalRange: fr, lineRanges: [fr] }
  }

  const lineRanges: DamageRange[] = []

  // 예외식(럭세/트스): 모션 무관 고정 base를 attackCount 라인으로
  if (p.lineBase) {
    const n = Math.max(1, p.attackCount || 1)
    const dists = Array.from({ length: n }, () => {
      const mix = critParts(p.lineBase!, 1)
      lineRanges.push({ min: mix.min, max: mix.max })
      return mixtureDist(mix.parts)
    })
    const dist = dists.reduce((acc, d) => convolve(acc, d))
    return { dist, totalRange: { min: dist.base, max: dist.base + (dist.p.length - 1) * dist.step }, lineRanges }
  }

  const lines = skillMotionLines(p.skillId, p.weaponType, p.attackCount)
  if (!lines) return null

  const lineDists: Dist[] = lines.map((comps) => {
    const parts: { weight: number; dist: Dist }[] = []
    let lmin = Infinity
    let lmax = -Infinity
    for (const { weight, mult } of comps) {
      const mix = critParts(physRange(p.primary ?? 0, p.secondary ?? 0, mult, p.watk ?? 0, p.mastery ?? 1), weight)
      parts.push(...mix.parts)
      lmin = Math.min(lmin, mix.min)
      lmax = Math.max(lmax, mix.max)
    }
    lineRanges.push({ min: lmin, max: lmax })
    return mixtureDist(parts)
  })

  const dist = lineDists.reduce((acc, d) => convolve(acc, d))
  return { dist, totalRange: { min: dist.base, max: dist.base + (dist.p.length - 1) * dist.step }, lineRanges }
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
}

export function computeNhit(castDist: Dist, hp: number, maxN = 10): NhitResult {
  const { exact, cumulative, over } = exactNProbabilities(castDist, hp, maxN)
  const meanHits = exact.reduce((a, x, i) => a + x * (i + 1), 0) + over * (maxN + 1)
  return { exact, cumulative, over, meanHits }
}

/** DPM = 기대 시전 데미지 × 분당 시전수 */
export function computeDpm(castDist: Dist, attacksPerMinute: number): number {
  return expectedValue(castDist) * attacksPerMinute
}

/** 원소 반응 → 기본 배율 (차지/리셋 미적용 시) */
export function baseElementMult(reaction: ElementReaction): number {
  return ELEMENT_MULT[reaction]
}
