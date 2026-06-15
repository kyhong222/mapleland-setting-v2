/**
 * 4대 기본 능력치(StatId)와 합산/적용 유틸.
 *
 * sumEffects(effects.ts)로 병합된 EffectMap을 받아 최종 기본 능력치를 계산한다.
 * percent 효과의 적용 방식/순서는 공격력 공식(attackPower.ts) 확정 시 함께
 * 재검토할 수 있으며, 현재 구현은 잠정(provisional)이다.
 */

import type { EffectId, EffectMap } from './effects'

/** 4대 기본 능력치 */
export type StatId = 'STR' | 'DEX' | 'INT' | 'LUK'

export const STAT_IDS: readonly StatId[] = ['STR', 'DEX', 'INT', 'LUK']

export type BaseStats = Record<StatId, number>

/** 각 기본 스탯에 대응하는 개별 % 효과 id */
const STAT_PERCENT_OF: Record<StatId, EffectId> = {
  STR: 'strP',
  DEX: 'dexP',
  INT: 'intP',
  LUK: 'lukP',
}

/** EffectMap에서 특정 효과 값을 읽는다(없으면 0). */
export function effectValue(effects: EffectMap, id: EffectId): number {
  return effects[id] ?? 0
}

/**
 * 합산된 효과를 기준으로 최종 기본 능력치(STR/DEX/INT/LUK)를 계산한다.
 *
 * 잠정 규칙:
 *   final = floor((base + flat) * (1 + (개별스탯% + 모든스탯%) / 100))
 *
 * @param base    캐릭터 순수 기본 스탯(레벨/AP 분배 등)
 * @param effects sumEffects로 병합된 전체 효과(장비 + 버프 등)
 */
export function computeBaseStats(base: BaseStats, effects: EffectMap): BaseStats {
  const allStatP = effectValue(effects, 'allStatP')
  const result = {} as BaseStats
  for (const stat of STAT_IDS) {
    const flat = effectValue(effects, stat)
    const perStatP = effectValue(effects, STAT_PERCENT_OF[stat])
    const total = (base[stat] + flat) * (1 + (perStatP + allStatP) / 100)
    result[stat] = Math.floor(total)
  }
  return result
}
