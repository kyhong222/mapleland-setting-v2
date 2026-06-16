/**
 * 착용(장착) 가능 여부 판정.
 * 부위는 슬롯 타겟팅에서 보장되므로, 여기선 직업/레벨/요구스탯을 검사한다.
 */

import type { ItemData } from './item'
import type { JobId } from './jobs'
import { JOBS } from './jobs'
import type { ClassId } from './jobs'
import type { BaseStats } from './stats'

/** 클래스 → reqJob 비트마스크 */
const CLASS_BIT: Record<ClassId, number> = {
  warrior: 1,
  magician: 2,
  bowman: 4,
  thief: 8,
  pirate: 16,
}

export interface WearContext {
  jobId: JobId
  level: number
  /** 판정 기준 스탯(현재 캐릭터 능력치) */
  stats: BaseStats
}

export interface WearCheck {
  ok: boolean
  reasons: string[]
}

/** 아이템 착용 조건 검사 (직업/레벨/요구스탯) */
export function checkWearable(item: ItemData, ctx: WearContext): WearCheck {
  const reasons: string[] = []

  const rj = item.reqJob ?? 0
  if (rj !== 0 && (rj & CLASS_BIT[JOBS[ctx.jobId].classId]) === 0) {
    reasons.push('직업이 맞지 않습니다')
  }
  if ((item.reqLevel ?? 0) > ctx.level) {
    reasons.push(`레벨 ${item.reqLevel} 이상 필요`)
  }
  if ((item.reqStr ?? 0) > ctx.stats.STR) reasons.push(`STR ${item.reqStr} 필요`)
  if ((item.reqDex ?? 0) > ctx.stats.DEX) reasons.push(`DEX ${item.reqDex} 필요`)
  if ((item.reqInt ?? 0) > ctx.stats.INT) reasons.push(`INT ${item.reqInt} 필요`)
  if ((item.reqLuk ?? 0) > ctx.stats.LUK) reasons.push(`LUK ${item.reqLuk} 필요`)

  return { ok: reasons.length === 0, reasons }
}
