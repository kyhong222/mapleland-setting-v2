/**
 * 세팅 상태 → 합산 효과/최종 스탯 파생 계산.
 * 장착은 인벤토리 아이템 id 참조이므로, 인벤토리에서 BuiltItem을 해석해 합산한다.
 */

import { sumEffects, maxEffects } from '../domain/effects'
import type { EffectMap } from '../domain/effects'
import { computeBaseStats } from '../domain/stats'
import type { BaseStats } from '../domain/stats'
import { resolveBuiltItem } from '../domain/builtItem'
import type { BuiltItem } from '../domain/builtItem'
import { buffEffectsAtLevel, canUseBuff } from '../domain/buff'
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
  appliedBuffs: Record<string, number>
  masteryLevels: Record<string, number>
  jobId: JobId | null
  weaponType?: WeaponType
}

/**
 * 활성 버프 → 합산 EffectMap.
 *  - activeBuffs(토글): 영메·메용 + 직업특화 패시브 → 단순 합산
 *  - appliedBuffs(적용 목록: 도핑/개인/파티) → 능력치별 최댓값 후 합산
 *    (같은 종류 버프는 중첩되지 않고 높은 쪽만 적용)
 *  - 무기 마스터리/엑스퍼트: 장착 주무기 타입이 일치할 때만 자동 적용(레벨=masteryLevels[id] ?? 마스터)
 */
export function activeBuffEffects(ctx: BuffContext): EffectMap {
  const { activeBuffs, appliedBuffs, masteryLevels, jobId, weaponType } = ctx
  const sumMaps: EffectMap[] = []
  // 토글 버프 (무기 게이팅 버프는 여기서 제외 — 아래서 따로 처리)
  for (const [id, level] of Object.entries(activeBuffs)) {
    const b = getBuff(id)
    if (b && !(b.type === 'skill' && b.weaponTypes)) sumMaps.push(buffEffectsAtLevel(b, level))
  }
  // 무기 마스터리/엑스퍼트 — 장착 주무기 일치 시 자동 적용
  if (jobId && weaponType) {
    for (const b of JOB_BUFFS) {
      if (b.type === 'skill' && b.weaponTypes?.includes(weaponType) && canUseBuff(b, jobId)) {
        sumMaps.push(buffEffectsAtLevel(b, masteryLevels[b.id] ?? b.masterLevel))
      }
    }
  }
  // 적용 버프(도핑/개인/파티) — 능력치별 최댓값 적용
  const appliedMaps: EffectMap[] = []
  for (const [id, level] of Object.entries(appliedBuffs)) {
    const b = getBuff(id)
    if (b) appliedMaps.push(buffEffectsAtLevel(b, level))
  }
  return sumEffects(...sumMaps, maxEffects(...appliedMaps))
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
