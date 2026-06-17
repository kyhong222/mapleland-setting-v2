/** 활성 버프 합산 EffectMap 훅 (토글 + 공통슬롯 + 무기 게이팅 마스터리) */
import type { EffectMap } from '../domain/effects'
import { useBuildStore } from './buildStore'
import { useInventoryStore } from './inventoryStore'
import { activeBuffEffects, equippedWeaponType } from './aggregate'

export function useBuffEffects(): EffectMap {
  const jobId = useBuildStore((s) => s.jobId)
  const activeBuffs = useBuildStore((s) => s.activeBuffs)
  const commonSlots = useBuildStore((s) => s.commonSlots)
  const commonLevels = useBuildStore((s) => s.commonLevels)
  const masteryLevels = useBuildStore((s) => s.masteryLevels)
  const equipped = useBuildStore((s) => s.equipped)
  const invItems = useInventoryStore((s) => s.items)
  const weaponType = equippedWeaponType(equipped, invItems)
  return activeBuffEffects({ activeBuffs, commonSlots, commonLevels, masteryLevels, jobId, weaponType })
}
