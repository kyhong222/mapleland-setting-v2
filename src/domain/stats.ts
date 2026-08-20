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

/**
 * 직업군별 스탯 기본값/하한.
 *  - base : 스탯 초기화(= 직업 선택) 시 기본으로 확보되는 값
 *  - min  : 사용자가 직접 내릴 수 있는 하한 (없으면 base와 동일 = 못 내림)
 *
 * 도적은 전직 요구 DEX 25가 초기화 후에도 유지돼 내릴 수 없다.
 * 해적은 초기화하면 20이지만 전직 직후에는 4일 수 있어 4까지 내릴 수 있게 둔다.
 * 어느 쪽이든 이 몫은 순수 스탯합 안에서 나가므로 총합은 다른 직업과 같다.
 */
interface StatFloorSpec {
  base: Partial<BaseStats>
  min?: Partial<BaseStats>
}
const CLASS_STAT_FLOOR: Partial<Record<ClassId, StatFloorSpec>> = {
  thief: { base: { DEX: 25 } },
  pirate: { base: { DEX: 20 }, min: { DEX: STAT_BASE } },
}

const pick = (src: Partial<BaseStats> | undefined): BaseStats => ({
  STR: src?.STR ?? STAT_BASE,
  DEX: src?.DEX ?? STAT_BASE,
  INT: src?.INT ?? STAT_BASE,
  LUK: src?.LUK ?? STAT_BASE,
})

/** 스탯 초기화 시 기본으로 확보되는 값 (도적 DEX 25 / 해적 DEX 20) */
export function statDefaults(classId: ClassId): BaseStats {
  return pick(CLASS_STAT_FLOOR[classId]?.base)
}

/** 사용자가 직접 내릴 수 있는 하한 (해적 DEX는 4까지 허용) */
export function statMinimums(classId: ClassId): BaseStats {
  const spec = CLASS_STAT_FLOOR[classId]
  const base = pick(spec?.base)
  const min = spec?.min
  return {
    STR: min?.STR ?? base.STR,
    DEX: min?.DEX ?? base.DEX,
    INT: min?.INT ?? base.INT,
    LUK: min?.LUK ?? base.LUK,
  }
}

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

/**
 * 최소(시작) 레벨 = 1차 전직 레벨. 이 아래로는 직업이 존재하지 않는다.
 * 마법사만 8, 나머지는 10.
 */
const MIN_LEVEL_BY_CLASS: Partial<Record<ClassId, number>> = { magician: 8 }
const MIN_LEVEL_DEFAULT = 10

export function minLevelForClass(classId: ClassId): number {
  return MIN_LEVEL_BY_CLASS[classId] ?? MIN_LEVEL_DEFAULT
}

/**
 * 레벨에 따른 분배 가능 AP (기본 4×4 위에 얹는 값. 순수스탯합 = 16 + AP).
 *  - 모험가: 4 + 레벨×5 + (≥70:+5) + (≥120:+5)
 *  - 시그너스: 3 + 레벨×5 + (10~70 구간 레벨업 +1, 최대 61) + (≥70:+5) + (≥120:+5)
 *    (실측검증: L120→스탯합 690[STR602/DEX80/4/4], L92→545[52/485/4/4])
 */
export function totalAP(level: number, order: JobOrder = 'explorer'): number {
  const jobBonus = (level >= 70 ? 5 : 0) + (level >= 120 ? 5 : 0)
  if (order === 'cygnus') {
    const cygnusBonus = Math.max(0, Math.min(level, 70) - 9)
    return 3 + level * 5 + cygnusBonus + jobBonus
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
