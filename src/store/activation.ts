/**
 * 활성화여부 (스켈레톤).
 *
 * - 장착가능여부: '장착' 시점의 prehook (장착 직전 현재 총스탯/레벨이 착용조건 만족하는지).
 *   → InventoryPanel의 장착 핸들러에서 checkWearable로 검사.
 * - 활성화여부: 장착 "후" 상태에서 각 장비가 활성인지. 장착 변경마다 1회 재평가.
 *   → 여기서 evaluateActivation / useActivation으로 계산.
 *
 * 정책 미정 — 현재는 모든 장착 장비를 활성으로 반환한다. 정책 확정 시 evaluateActivation만 채우면 됨.
 */

import { useMemo } from 'react'
import type { JobId } from '../domain/jobs'
import type { BaseStats } from '../domain/stats'
import type { BuiltItem } from '../domain/builtItem'
import type { EquipInstance } from './equipInstance'
import { equippedBuiltMap } from './aggregate'
import { useBuildStore } from './buildStore'
import { useInventoryStore } from './inventoryStore'

export interface ActivationInput {
  jobId: JobId
  level: number
  baseStats: BaseStats
  /** 장착 후 인스턴스별 장비 (활성 판정 대상) */
  equippedItems: Partial<Record<EquipInstance, BuiltItem>>
}

export type ActivationMap = Partial<Record<EquipInstance, boolean>>

/**
 * 장착 후 상태에서 각 장비의 활성여부 판정.
 * TODO(정책 미정): 현재는 전부 활성. 추후 레벨/스탯/세트 등 정책 적용.
 */
export function evaluateActivation(input: ActivationInput): ActivationMap {
  const active: ActivationMap = {}
  for (const inst of Object.keys(input.equippedItems) as EquipInstance[]) {
    active[inst] = true // TODO: 활성화 정책 적용
  }
  return active
}

/** 장착 변경 시마다 재평가되는 활성화 맵 (스켈레톤) */
export function useActivation(): ActivationMap {
  const jobId = useBuildStore((s) => s.jobId)
  const level = useBuildStore((s) => s.level)
  const baseStats = useBuildStore((s) => s.baseStats)
  const equipped = useBuildStore((s) => s.equipped)
  const invItems = useInventoryStore((s) => s.items)

  return useMemo(() => {
    if (!jobId) return {}
    return evaluateActivation({
      jobId,
      level,
      baseStats,
      equippedItems: equippedBuiltMap(equipped, invItems),
    })
  }, [jobId, level, baseStats, equipped, invItems])
}
