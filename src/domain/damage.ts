/**
 * 스킬 데미지 파이프라인 (ayumilove 10단계, docs/plan.md 확정).
 *
 *  1. 기본 데미지(base)      — 물리 무기식 / 마법 Spell식(mad) 결과를 호출부가 주입
 *  2. 속성 배율              — 약점 1.5× / 반감 0.5× / 무효 0×
 *  3. 몬스터 방어 감소        — 물리 ×(1−0.01D)−WDEF×(0.5/0.6), 마법 −MDEF×(0.5/0.6)×(1+0.01D)
 *  4~7. 랜덤 X × (스킬% [+크리])
 *  8. clamp [1, 199999]
 *  9. After-modifier          — 미구현(=1)
 *  10. floor
 *
 * range 표기이므로 min/max 각각에 파이프라인을 적용한다.
 */

import type { DamageRange } from './attackPower'

export type ElementReaction = 'weak' | 'half' | 'immune' | 'none'
export const ELEMENT_MULT: Record<ElementReaction, number> = { weak: 1.5, half: 0.5, immune: 0, none: 1 }

/** 데미지 상한 (메이플랜드) */
export const DAMAGE_CAP = 199999

export interface SkillDefense {
  kind: 'physical' | 'magic'
  /** 몬스터 방어력 (물리 WDEF / 마법 MDEF) */
  def: number
  /** 렙차 D = max(0, 몬레벨 − 캐릭레벨) */
  levelPenalty: number
  /** 방어 무시(소환수/어썰터 등) */
  ignore?: boolean
}

export interface SkillDamageParams {
  /** 1단계 기본 데미지 (물리 무기식 / 마법 spell식 결과) */
  base: DamageRange
  /** 2단계 속성 반응 (기본 none) */
  element?: ElementReaction
  /** 3단계 몬스터 방어 (없으면 미적용) */
  defense?: SkillDefense
  /** 5단계 스킬 배율 % (기본공격/마법 100) */
  skillPercent: number
  /**
   * 6단계 크리 순보너스 % (0이면 크리 없음).
   * = (크리스킬% − 100) + 샤프아이즈(140) + …  ← −100은 크리스킬에만, 샤프는 순증가.
   * 크리 데미지 = 스킬% + critBonus.
   */
  critBonus?: number
}

export interface SkillDamageResult {
  /** 비크리 데미지 */
  normal: DamageRange
  /** 크리 데미지 (critPercent>0일 때) */
  critical: DamageRange | null
}

/** 3단계 방어 감소 (floor/clamp 없이 raw float) */
function applyDefenseRaw(range: DamageRange, d: SkillDefense): DamageRange {
  if (d.ignore) return range
  if (d.kind === 'physical') {
    const f = 1 - 0.01 * d.levelPenalty
    return { max: range.max * f - d.def * 0.5, min: range.min * f - d.def * 0.6 }
  }
  const g = 1 + 0.01 * d.levelPenalty
  return { max: range.max - d.def * 0.5 * g, min: range.min - d.def * 0.6 * g }
}

/** 8·10단계: [1, 199999] clamp 후 floor */
const clampFloor = (x: number): number => Math.floor(Math.min(DAMAGE_CAP, Math.max(1, x)))

function scale(range: DamageRange, mult: number): DamageRange {
  return { min: clampFloor(range.min * mult), max: clampFloor(range.max * mult) }
}

/** 스킬 데미지 파이프라인 실행 (비크리/크리 range 반환) */
export function computeSkillDamage(p: SkillDamageParams): SkillDamageResult {
  // 2단계 속성
  const em = ELEMENT_MULT[p.element ?? 'none']
  let r: DamageRange = { min: p.base.min * em, max: p.base.max * em }
  // 3단계 방어
  if (p.defense) r = applyDefenseRaw(r, p.defense)
  // 5단계 스킬 배율 (비크리)
  const normal = scale(r, p.skillPercent / 100)
  // 6단계 크리 = 스킬% + 크리 순보너스
  let critical: DamageRange | null = null
  if (p.critBonus && p.critBonus > 0) {
    critical = scale(r, (p.skillPercent + p.critBonus) / 100)
  }
  return { normal, critical }
}
