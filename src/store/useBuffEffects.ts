/** 활성 버프 합산 EffectMap 훅 (토글 + 공통슬롯 + 무기 게이팅 마스터리) */
import type { EffectMap } from '../domain/effects'
import { useBuildStore } from './buildStore'
import { useInventoryStore } from './inventoryStore'
import { activeBuffEffects, conditionalBuffEffects, equippedWeaponType, equippedHasShield } from './aggregate'
import type { BuffContext } from './aggregate'
import type { BuffCondition } from '../domain/buff'

/** 현재 빌드의 버프 계산 컨텍스트 (무기/방패 게이팅 포함) */
export function useBuffContext(): BuffContext {
  const jobId = useBuildStore((s) => s.jobId)
  const activeBuffs = useBuildStore((s) => s.activeBuffs)
  const appliedBuffs = useBuildStore((s) => s.appliedBuffs)
  const masteryLevels = useBuildStore((s) => s.masteryLevels)
  const masteryOff = useBuildStore((s) => s.masteryOff)
  const equipped = useBuildStore((s) => s.equipped)
  const invItems = useInventoryStore((s) => s.items)
  const weaponType = equippedWeaponType(equipped, invItems)
  const hasShield = equippedHasShield(equipped, invItems)
  return { activeBuffs, appliedBuffs, masteryLevels, masteryOff, jobId, weaponType, hasShield }
}

export function useBuffEffects(): EffectMap {
  return activeBuffEffects(useBuffContext())
}

/**
 * 조건부 버프(스턴 마스터리 등)만 합산한 EffectMap.
 * 상시 효과에는 안 들어가므로, 그 상황을 가정하는 계산에서 위에 더해 쓴다.
 */
export function useConditionalBuffEffects(condition: BuffCondition): EffectMap {
  return conditionalBuffEffects(useBuffContext(), condition)
}
