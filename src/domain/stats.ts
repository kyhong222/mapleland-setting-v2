/**
 * 4대 기본 능력치(StatId)와 합산/적용 유틸.
 *
 * sumEffects(effects.ts)로 병합된 EffectMap을 받아 최종 기본 능력치를 계산한다.
 * percent 효과의 적용 방식/순서는 공격력 공식(attackPower.ts) 확정 시 함께
 * 재검토할 수 있으며, 현재 구현은 잠정(provisional)이다.
 */

import type { EffectId, EffectMap } from './effects'
import type { ClassId, JobOrder } from './jobs'

/** 4대 기본 능력치 */
export type StatId = 'STR' | 'DEX' | 'INT' | 'LUK'

export const STAT_IDS: readonly StatId[] = ['STR', 'DEX', 'INT', 'LUK']

export type BaseStats = Record<StatId, number>

/** 능력치 기본값 (모험가) */
export const STAT_BASE = 4

/** 한 능력치에 AP로 투자 가능한 최대값 */
export const MAX_STAT = 999

/** 계열별 최대 레벨 (모험가 200 / 시그너스 120) */
export const MAX_LEVEL_BY_ORDER: Record<JobOrder, number> = {
  explorer: 200,
  cygnus: 120,
}

/** 계열별 최대 레벨 (order 미지정 시 모험가 기준) */
export function maxLevelForOrder(order: JobOrder = 'explorer'): number {
  return MAX_LEVEL_BY_ORDER[order]
}

/** @deprecated 모험가 최대 레벨. 계열별 값은 maxLevelForOrder 사용. */
export const MAX_LEVEL = MAX_LEVEL_BY_ORDER.explorer

/** 최소 레벨 (입력 편의상 전 직업 1로 통일) */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function minLevelForClass(_classId: ClassId): number {
  return 1
}

/**
 * 레벨에 따른 분배 가능 AP.
 *  - 모험가: 4 + 레벨×5 + (≥70:+5) + (≥120:+5)
 *  - 시그너스: 19 + 레벨×5 + (10~70 구간 레벨업 +1, 최대 61) + (≥70:+5) + (≥120:+5)
 *    (검증: L62→382, L120→690)
 */
export function totalAP(level: number, order: JobOrder = 'explorer'): number {
  const jobBonus = (level >= 70 ? 5 : 0) + (level >= 120 ? 5 : 0)
  if (order === 'cygnus') {
    const cygnusBonus = Math.max(0, Math.min(level, 70) - 9)
    return 19 + level * 5 + cygnusBonus + jobBonus
  }
  return 4 + level * 5 + jobBonus
}

/** 순수 스탯합 = 기본값(4×4) + 분배 AP */
export function totalPureStats(level: number, order: JobOrder = 'explorer'): number {
  return STAT_BASE * STAT_IDS.length + totalAP(level, order)
}

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
 * 규칙: % 보너스(모든스탯% + 개별스탯%)는 순수 스탯에만 적용하고,
 * 장비/플랫 버프 스탯은 % 적용 후 가산한다.
 *   final = floor(순수스탯 * (1 + (개별스탯% + 모든스탯%) / 100)) + 플랫스탯
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
    result[stat] = Math.floor(base[stat] * (1 + (perStatP + allStatP) / 100)) + flat
  }
  return result
}
