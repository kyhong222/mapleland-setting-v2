/**
 * vs 몬스터 전투 성능 계산 — 명중확률 · 필요명중률 · 물리/마법 회피확률.
 *
 * 출처: v1 mapleland-setting/src/components/DamageReceivedTable.tsx.
 *
 * 입력 명중/회피는 세부스탯(detailStats.ts)과 동일 규칙으로 산출한다.
 *  - 회피치: 모든 직업 computeDetailStats().eva
 *  - 명중치: 마법사=마법명중(floor(INT/10)+floor(LUK/10)), 그 외=물리명중(detail.acc)
 *
 * 페이크 등 추가 회피확률(effects.addEvadeP)은 독립 판정으로 회피확률에 합성한다.
 */

import type { EffectMap } from './effects'
import type { JobId } from './jobs'
import { JOBS } from './jobs'
import type { BaseStats } from './stats'
import { computeDetailStats } from './detailStats'

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x))

/** 마법 명중치 (마법사): floor(총INT/10) + floor(총LUK/10). v2는 장비 마법명중 미모델. */
export function magicAccuracy(finalStats: BaseStats): number {
  return Math.floor(finalStats.INT / 10) + Math.floor(finalStats.LUK / 10)
}

/**
 * 명중확률(%).
 *  - 마법사: {마법명중치 / (몬스터회피치 + 1)} × {1 + 0.0415 × (캐릭레벨 − 몬레벨)}
 *  - 그 외: {명중치 / ((11/6 + 0.07×D) × 몬스터회피치)} − 1,  D = max(0, 몬레벨 − 캐릭레벨)
 */
export function hitRate(playerAcc: number, playerLevel: number, monLevel: number, monEva: number, isMagician: boolean): number {
  if (monEva <= 0) return 100
  if (isMagician) {
    const raw = (playerAcc / (monEva + 1)) * (1 + 0.0415 * (playerLevel - monLevel))
    return clamp(raw * 100, 0, 100)
  }
  const D = Math.max(0, monLevel - playerLevel)
  const raw = playerAcc / ((11 / 6 + 0.07 * D) * monEva) - 1
  return clamp(raw * 100, 0, 100)
}

/** 100% 명중에 필요한 명중치 (모험 불가면 Infinity). */
export function requiredAcc(playerLevel: number, monLevel: number, monEva: number, isMagician: boolean): number {
  if (monEva <= 0) return 0
  if (isMagician) {
    const modifier = 1 + 0.0415 * (playerLevel - monLevel)
    if (modifier <= 0) return Infinity
    return Math.ceil((monEva + 1) / modifier)
  }
  const D = Math.max(0, monLevel - playerLevel)
  return Math.round(2 * (11 / 6 + 0.07 * D) * monEva)
}

/** 페이크 등 추가회피(addEvadeP%)를 base 회피확률에 독립 판정으로 합성. */
function combineExtraEvade(basePercent: number, addEvadeP: number): number {
  if (addEvadeP <= 0) return basePercent
  return (1 - (1 - basePercent / 100) * (1 - addEvadeP / 100)) * 100
}

/** 물리 회피확률(%) = totalEva / (4.5 × 몬스터명중) — 도적 5~95 / 그 외 2~80 clamp. */
export function physEvadeRate(totalEva: number, monAcc: number, isThief: boolean, addEvadeP: number): number {
  const min = isThief ? 5 : 2
  const max = isThief ? 95 : 80
  const base = monAcc <= 0 ? max : clamp((totalEva / (4.5 * monAcc)) * 100, min, max)
  return combineExtraEvade(base, addEvadeP)
}

/** 마법 회피확률(%) = 10/9 − 몬스터명중 / (0.9 × totalEva) — 물리와 동일 clamp. */
export function magicEvadeRate(totalEva: number, monAcc: number, isThief: boolean, addEvadeP: number): number {
  const min = isThief ? 5 : 2
  const max = isThief ? 95 : 80
  const base = monAcc <= 0 || totalEva <= 0 ? max : clamp((10 / 9 - monAcc / (0.9 * totalEva)) * 100, min, max)
  return combineExtraEvade(base, addEvadeP)
}

/** 대상 몬스터 (전투 수치만 사용) */
export interface CombatMonster {
  level: number
  acc?: number
  eva?: number
}

export interface VsMonsterResult {
  /** 명중확률 % */
  hitRate: number
  /** 100% 명중에 필요한 명중치 (Infinity 가능) */
  requiredAcc: number
  /** 물리 회피확률 % */
  physEvade: number
  /** 마법 회피확률 % */
  magicEvade: number
  /** 마법사 여부 (표기 라벨용) */
  isMagician: boolean
}

/** 선택 직업/스탯 vs 몬스터 성능 일괄 계산. */
export function computeVsMonster(
  jobId: JobId,
  playerLevel: number,
  finalStats: BaseStats,
  effects: EffectMap,
  monster: CombatMonster,
): VsMonsterResult {
  const job = JOBS[jobId]
  const isMagician = job.attackType === 'magical'
  const isThief = job.classId === 'thief'
  const detail = computeDetailStats(jobId, finalStats, effects)
  const acc = isMagician ? magicAccuracy(finalStats) : detail.acc
  const eva = detail.eva
  const addEvadeP = effects.addEvadeP ?? 0
  const monEva = monster.eva ?? 0
  const monAcc = monster.acc ?? 0
  return {
    hitRate: hitRate(acc, playerLevel, monster.level, monEva, isMagician),
    requiredAcc: requiredAcc(playerLevel, monster.level, monEva, isMagician),
    physEvade: physEvadeRate(eva, monAcc, isThief, addEvadeP),
    magicEvade: magicEvadeRate(eva, monAcc, isThief, addEvadeP),
    isMagician,
  }
}
