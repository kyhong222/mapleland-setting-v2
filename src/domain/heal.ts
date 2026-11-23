/**
 * 힐(비숍 2301002) HP 회복량 — docs/plan.md §특수 스킬 공식 "힐 회복량"
 *
 * 출처: mnwvs077(v77) `WvsGame/USkill.cpp` `DoActiveSkill_PartyStatChange`. 메랜 실측은 아직 없다.
 *   R    = 0 ~ ⌊INT × 0.2⌋ − 1 균등 정수 난수 (시전당 한 번 — 파티원 전원이 같은 양을 회복)
 *   P    = ⌊(R × 1.15 + LUK) × 총마력 / 100⌋
 *   총량 = ⌊P × (1 + 0.3 × 대상수) × 회복력% / 100⌋
 *   1인당 = ⌊총량 / 대상수⌋
 */

import type { DamageRange } from './attackPower'

/** 힐 대상 수 범위 — 시전자 포함, 파티 최대 6인 */
export const HEAL_TARGETS_MIN = 1
export const HEAL_TARGETS_MAX = 6

/** 대상 수를 1~6 정수로 맞춘다 (빈 입력·이상값은 1) */
export function clampHealTargets(n: number): number {
  return Math.max(HEAL_TARGETS_MIN, Math.min(HEAL_TARGETS_MAX, Math.floor(n) || HEAL_TARGETS_MIN))
}

/** 1인당 배율 = (1 + 0.3N) / N — 총량은 늘지만 1인당은 줄어든다 */
export function healTargetMult(targets: number): number {
  return (1 + 0.3 * targets) / targets
}

/**
 * 1인당 HP 회복량.
 * @param magic      총마력
 * @param hpPercent  스킬 회복력%(WZ `hp`, 30레벨 300)
 * @param targets    회복 대상 수(시전자 포함)
 */
export function healRecovery(int: number, luk: number, magic: number, hpPercent: number, targets: number): DamageRange {
  const at = (r: number) => {
    const p = Math.floor(((r * 1.15 + luk) * magic) / 100)
    // 부동소수 오차로 정확한 정수가 1 깎이지 않게 정수로 모아 나눈다 (1 + 0.3N = (10 + 3N)/10)
    const total = Math.floor((p * (10 + 3 * targets) * hpPercent) / 1000)
    return Math.floor(total / targets)
  }
  return { min: at(0), max: at(Math.max(0, Math.floor(int * 0.2) - 1)) }
}
