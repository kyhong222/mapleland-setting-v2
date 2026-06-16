/**
 * 세팅 상태 → 합산 효과/최종 스탯 파생 계산.
 * 장착은 인벤토리 아이템 id 참조이므로, 인벤토리에서 BuiltItem을 해석해 합산한다.
 */

import { sumEffects } from '../domain/effects'
import type { EffectMap } from '../domain/effects'
import { computeBaseStats } from '../domain/stats'
import type { BaseStats } from '../domain/stats'
import { resolveBuiltItem } from '../domain/builtItem'
import type { BuiltItem } from '../domain/builtItem'
import type { EquipInstance } from './equipInstance'
import type { InventoryItem } from './inventoryStore'

/** 장착(슬롯→invId) + 인벤토리 → 인스턴스별 BuiltItem 맵 */
export function equippedBuiltMap(
  equipped: Partial<Record<EquipInstance, string>>,
  invItems: InventoryItem[],
): Partial<Record<EquipInstance, BuiltItem>> {
  const byId = new Map(invItems.map((it) => [it.id, it.built]))
  const map: Partial<Record<EquipInstance, BuiltItem>> = {}
  for (const [inst, id] of Object.entries(equipped) as [EquipInstance, string][]) {
    const b = byId.get(id)
    if (b) map[inst] = b
  }
  return map
}

/** 장착(슬롯→invId) + 인벤토리 → 장착된 BuiltItem 목록 */
export function equippedBuilts(
  equipped: Partial<Record<EquipInstance, string>>,
  invItems: InventoryItem[],
): BuiltItem[] {
  return Object.values(equippedBuiltMap(equipped, invItems)).filter(
    (b): b is BuiltItem => !!b,
  )
}

export interface Aggregated {
  effects: EffectMap
  finalStats: BaseStats
}

export function aggregateBuild(baseStats: BaseStats, builts: BuiltItem[]): Aggregated {
  const effects = sumEffects(...builts.map((b) => resolveBuiltItem(b).finalEffects))
  const finalStats = computeBaseStats(baseStats, effects)
  return { effects, finalStats }
}
