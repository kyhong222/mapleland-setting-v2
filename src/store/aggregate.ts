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
import { buffEffectsAtLevel, defaultBuffLevel, canUseBuff } from '../domain/buff'
import { getBuff, JOB_BUFFS } from '../data/buff'
import type { JobId } from '../domain/jobs'
import type { WeaponType } from '../domain/weapons'
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

/** 장착 주무기의 무기 타입 (없으면 undefined) */
export function equippedWeaponType(
  equipped: Partial<Record<EquipInstance, string>>,
  invItems: InventoryItem[],
): WeaponType | undefined {
  const id = equipped.weapon
  if (!id) return undefined
  return invItems.find((it) => it.id === id)?.built.base.weaponType
}

export interface BuffContext {
  activeBuffs: Record<string, number>
  commonSlots: Record<string, string>
  commonLevels: Record<string, number>
  masteryLevels: Record<string, number>
  jobId: JobId | null
  weaponType?: WeaponType
}

/**
 * 활성 버프 → 합산 EffectMap.
 *  - activeBuffs(토글): 영메·메용 + 직업특화 패시브
 *  - commonSlots(8슬롯): 슬롯키→buffId, 기본 레벨. buffId 중복 제거
 *  - 무기 마스터리/엑스퍼트: 장착 주무기 타입이 일치할 때만 자동 적용(레벨=masteryLevels[id] ?? 마스터)
 */
export function activeBuffEffects(ctx: BuffContext): EffectMap {
  const { activeBuffs, commonSlots, commonLevels, masteryLevels, jobId, weaponType } = ctx
  const maps: EffectMap[] = []
  // 토글 버프 (무기 게이팅 버프는 여기서 제외 — 아래서 따로 처리)
  for (const [id, level] of Object.entries(activeBuffs)) {
    const b = getBuff(id)
    if (b && !(b.type === 'skill' && b.weaponTypes)) maps.push(buffEffectsAtLevel(b, level))
  }
  // 공통버프 8슬롯 (slot 레벨 반영, buffId 중복 제거)
  for (const id of new Set(Object.values(commonSlots))) {
    const b = getBuff(id)
    if (b) maps.push(buffEffectsAtLevel(b, commonLevels[id] ?? defaultBuffLevel(b)))
  }
  // 무기 마스터리/엑스퍼트 — 장착 주무기 일치 시 자동 적용
  if (jobId && weaponType) {
    for (const b of JOB_BUFFS) {
      if (b.type === 'skill' && b.weaponTypes?.includes(weaponType) && canUseBuff(b, jobId)) {
        maps.push(buffEffectsAtLevel(b, masteryLevels[b.id] ?? b.masterLevel))
      }
    }
  }
  return sumEffects(...maps)
}

export interface Aggregated {
  effects: EffectMap
  finalStats: BaseStats
}

export function aggregateBuild(
  baseStats: BaseStats,
  builts: BuiltItem[],
  buffEffects: EffectMap = {},
): Aggregated {
  const effects = sumEffects(...builts.map((b) => resolveBuiltItem(b).finalEffects), buffEffects)
  const finalStats = computeBaseStats(baseStats, effects)
  return { effects, finalStats }
}
