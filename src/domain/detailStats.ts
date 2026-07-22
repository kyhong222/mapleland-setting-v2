/**
 * 세부(상세) 스탯 계산.
 *
 * 아이템·스킬·도핑·패시브로 얻은 값은 모두 aggregate 단계에서 EffectMap으로 합산된다.
 * 여기서는 그 합산값에 직업별 스탯 유래분(명중/회피)·INT 유래분(마방)을 더해
 * 스탯 창에 표시되는 최종 세부 스탯을 만든다.
 *
 * 직업별 명중/회피 공식은 메이플랜드 기준(기획안 1번):
 *  - 명중률
 *      전사·법사(+초보자)          : DEX×0.8 + LUK×0.5 + 명중률
 *      인파이터 계열(바이퍼)        : DEX×0.9 + LUK×0.3 + 명중률
 *      궁수·도적·건슬링거·스트라이커 : DEX×0.6 + LUK×0.3 + 명중률
 *  - 회피율
 *      그 외 전부(+스트라이커)      : DEX×0.25  + LUK×0.5 + 회피율
 *      인파이터 계열(바이퍼)        : DEX×1.5   + LUK×0.5 + 회피율
 *      건슬링거 계열(캡틴)          : DEX×0.125 + LUK×0.5 + 회피율
 *  - 마법방어력 : 합산 마방 + 총 INT (INT 1당 +1)
 *
 * 이동속도/점프력은 기본 100에서 합산 보정을 더하고 하드캡(140/123)으로 clamp.
 * (HP/MP는 현재 표기하지 않는다.)
 */

import type { EffectId, EffectMap } from './effects'
import type { JobId } from './jobs'
import { JOBS } from './jobs'
import type { BaseStats } from './stats'

const BASE_SPEED = 100
const BASE_JUMP = 100
const MAX_SPEED = 140
const MAX_JUMP = 123

/** DEX/LUK 스탯보정 계수 */
interface StatCoef {
  dex: number
  luk: number
}

/** 명중률 스탯보정 계수 (직업군별) */
export function accStatCoef(jobId: JobId): StatCoef {
  if (jobId === 'viper') return { dex: 0.9, luk: 0.3 } // 인파이터 계열
  const cls = JOBS[jobId].classId
  if (cls === 'warrior' || cls === 'magician') return { dex: 0.8, luk: 0.5 }
  // 궁수·도적·건슬링거(캡틴)·스트라이커
  return { dex: 0.6, luk: 0.3 }
}

/** 회피율 스탯보정 계수 (직업군별) */
export function evaStatCoef(jobId: JobId): StatCoef {
  if (jobId === 'viper') return { dex: 1.5, luk: 0.5 } // 인파이터 계열
  if (jobId === 'captain') return { dex: 0.125, luk: 0.5 } // 건슬링거 계열
  return { dex: 0.25, luk: 0.5 } // 그 외(스트라이커 포함)
}

export interface DetailStats {
  /** 명중률 (물리) */
  acc: number
  /** 회피율 */
  eva: number
  /** 물리방어력 */
  pdef: number
  /** 마법방어력 */
  mdef: number
  /** 이동속도 (기본 100 + 보정, 최대 140) */
  speed: number
  /** 점프력 (기본 100 + 보정, 최대 123) */
  jump: number
}

/**
 * 세부 스탯 계산.
 * @param jobId      선택 직업
 * @param finalStats 최종 능력치(STR/DEX/INT/LUK, 스탯 공식 적용 후)
 * @param effects    합산된 전체 효과(장비·버프·패시브·마스터리 등)
 */
export function computeDetailStats(jobId: JobId, finalStats: BaseStats, effects: EffectMap): DetailStats {
  const v = (id: EffectId): number => effects[id] ?? 0
  const acc = accStatCoef(jobId)
  const eva = evaStatCoef(jobId)
  return {
    acc: finalStats.DEX * acc.dex + finalStats.LUK * acc.luk + v('acc') + v('acc_botf'),
    eva: finalStats.DEX * eva.dex + finalStats.LUK * eva.luk + v('eva') + v('eva_botf'),
    pdef: v('pdef'),
    mdef: v('mdef') + finalStats.INT,
    speed: Math.min(MAX_SPEED, BASE_SPEED + v('speed') + v('speed_burning')),
    jump: Math.min(MAX_JUMP, BASE_JUMP + v('jump') + v('jump_burning')),
  }
}
