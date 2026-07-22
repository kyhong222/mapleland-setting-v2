/**
 * 활성화여부 판정.
 *
 * - 장착가능여부: '장착' 시점의 prehook (장착 직전 현재 총스탯/레벨이 착용조건 만족하는지).
 *   → InventoryPanel의 장착 핸들러에서 checkWearable로 검사.
 * - 활성화여부: 장착 "후" 상태에서 각 장비가 활성인지. 장착 변경마다 재평가.
 *   → 여기서 evaluateActivation / useActivation으로 계산.
 *
 * 정책: 장착된 상태에서 각 장비의 요구조건(레벨/직업/요구스탯)을 만족하면 활성.
 * 요구스탯은 "자기 자신을 제외한 다른 활성 장비"의 보너스만 반영해 판정한다
 * (자기 장비가 올려주는 스탯은 자기 요구치 충족에 쓰이지 않음 — 인게임과 동일).
 * 어떤 장비가 비활성이 되면 그 스탯이 빠지면서 다른 장비가 연쇄 비활성될 수 있으므로
 * 변화가 없을 때까지 반복(fixpoint)한다. 비활성 장비는 스탯 계산에서 제외된다.
 */

import { useMemo } from 'react'
import type { JobId } from '../domain/jobs'
import type { BaseStats } from '../domain/stats'
import { computeBaseStats } from '../domain/stats'
import { sumEffects } from '../domain/effects'
import { resolveBuiltItem } from '../domain/builtItem'
import type { BuiltItem } from '../domain/builtItem'
import { checkWearable } from '../domain/equip'
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
 * 장착 후 상태에서 각 장비의 활성여부 판정 (fixpoint).
 * 자기 자신을 제외한 활성 장비 효과 합으로 요구조건을 검사한다.
 */
export function evaluateActivation(input: ActivationInput): ActivationMap {
  const insts = Object.keys(input.equippedItems) as EquipInstance[]
  if (insts.length === 0) return {}

  const effOf = (inst: EquipInstance) => resolveBuiltItem(input.equippedItems[inst]!).finalEffects
  const active = new Set<EquipInstance>(insts)

  let changed = true
  while (changed) {
    changed = false
    for (const inst of insts) {
      if (!active.has(inst)) continue
      const others = [...active].filter((i) => i !== inst).map(effOf)
      const stats = computeBaseStats(input.baseStats, sumEffects(...others))
      const check = checkWearable(input.equippedItems[inst]!.base, {
        jobId: input.jobId,
        level: input.level,
        stats,
      })
      if (!check.ok) {
        active.delete(inst)
        changed = true
      }
    }
  }

  const map: ActivationMap = {}
  for (const inst of insts) map[inst] = active.has(inst)
  return map
}

/** 장착 변경 시마다 재평가되는 활성화 맵 */
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

/** 활성 장비만 추린 BuiltItem 목록 (비활성=요구조건 미달 장비 제외 → 스탯 계산용) */
export function useActiveEquippedBuilts(): BuiltItem[] {
  const equipped = useBuildStore((s) => s.equipped)
  const invItems = useInventoryStore((s) => s.items)
  const activation = useActivation()

  return useMemo(() => {
    const map = equippedBuiltMap(equipped, invItems)
    return (Object.keys(map) as EquipInstance[])
      .filter((inst) => activation[inst] !== false)
      .map((inst) => map[inst]!)
  }, [equipped, invItems, activation])
}
