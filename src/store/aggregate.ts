/**
 * 세팅 상태 → 합산 효과/최종 스탯 파생 계산.
 * 장착은 인벤토리 아이템 id 참조이므로, 인벤토리에서 BuiltItem을 해석해 합산한다.
 */

import { sumEffects, maxEffects } from '../domain/effects'
import type { EffectId, EffectMap } from '../domain/effects'
import { RESOURCE_IDS } from '../domain/resource'
import { computeBaseStats } from '../domain/stats'
import type { BaseStats } from '../domain/stats'
import { resolveBuiltItem } from '../domain/builtItem'
import type { BuiltItem } from '../domain/builtItem'
import { buffEffectsAtLevel, canUseBuff, effectiveMasterLevel } from '../domain/buff'
import type { Buff, BuffCondition, SkillBuff } from '../domain/buff'
import { getBuff, JOB_BUFFS } from '../data/buff'
import type { JobId } from '../domain/jobs'
import { WEAPON_CONSTANTS } from '../domain/weapons'
import type { SecondaryWeapon, WeaponType } from '../domain/weapons'
import type { SlotId } from '../domain/equipSlots'
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

/** 보조무기 슬롯에 장착된 아이템의 부위 (없으면 undefined) */
export function equippedSecondarySlot(
  equipped: Partial<Record<EquipInstance, string>>,
  invItems: InventoryItem[],
): SlotId | undefined {
  const id = equipped.secondary
  if (!id) return undefined
  return invItems.find((it) => it.id === id)?.built.base.slot
}

/** 보조무기 슬롯에 방패가 장착돼 있는지 (블로킹 조건) */
export function equippedHasShield(
  equipped: Partial<Record<EquipInstance, string>>,
  invItems: InventoryItem[],
): boolean {
  return equippedSecondarySlot(equipped, invItems) === 'shield'
}

/**
 * 주무기가 요구하는 보조무기(아대의 표창 등)가 비어 있으면 그 종류를 돌려준다.
 * 채워져 있거나 애초에 필수가 아니면 undefined. → 소비처는 무기 미장착과 같이 취급한다.
 */
export function missingRequiredSecondary(
  weaponType: WeaponType | undefined,
  equipped: Partial<Record<EquipInstance, string>>,
  invItems: InventoryItem[],
): SecondaryWeapon[] | undefined {
  if (!weaponType) return undefined
  const need = WEAPON_CONSTANTS[weaponType].secondaryRequired
  if (!need) return undefined
  const slot = equippedSecondarySlot(equipped, invItems)
  if (slot && (need as string[]).includes(slot)) return undefined
  return need
}

/**
 * 무기 마스터리가 여러 개인 직업의 기본 무기 — 주무기 미장착(또는 마스터리가
 * 없는 무기 장착) 시 UI에 어떤 마스터리를 보여줄지 고르는 기준.
 * 마스터리가 한 종류뿐인 직업은 여기 없어도 그 마스터리로 자동 폴백된다.
 */
const DEFAULT_MASTERY_WEAPON: Partial<Record<JobId, WeaponType>> = {
  hero: 'oneHandedSword',
  paladin: 'oneHandedSword',
  darkKnight: 'spear',
}

/** 해당 직업이 가진 무기 마스터리/엑스퍼트 전부 */
export function jobMasteries(jobId: JobId | null): SkillBuff[] {
  if (!jobId) return []
  return JOB_BUFFS.filter(
    (b): b is SkillBuff => b.type === 'skill' && !!b.weaponTypes && canUseBuff(b, jobId),
  )
}

/** 장착 주무기에 실제로 적용되는 마스터리 (효과 합산 대상) */
export function appliedMasteries(jobId: JobId | null, weaponType?: WeaponType): SkillBuff[] {
  if (!weaponType) return []
  return jobMasteries(jobId).filter((b) => b.weaponTypes?.includes(weaponType))
}

/**
 * 무기 게이팅 통과 여부. weaponTypes가 붙은 스킬(무기 마스터리/엑스퍼트, 무기 부스터)은
 * 인게임에서도 해당 무기를 들었을 때만 적용/시전되므로, 장착 주무기가 맞아야 효과가 들어간다.
 * weaponTypes가 없는 버프(윈드 부스터 등 무기를 가리지 않는 것)는 항상 통과한다.
 */
export function weaponGateOk(buff: Buff, weaponType?: WeaponType): boolean {
  if (buff.type !== 'skill' || !buff.weaponTypes) return true
  return !!weaponType && buff.weaponTypes.includes(weaponType)
}

/**
 * UI에 표시할 마스터리. 장착 주무기에 해당하는 것이 있으면 그것,
 * 없으면(무기 미장착 등) 직업 기본 무기의 마스터리를 보여준다.
 * 표시용일 뿐이라 효과 합산은 appliedMasteries만 따른다.
 */
export function displayedMasteries(jobId: JobId | null, weaponType?: WeaponType): SkillBuff[] {
  const applied = appliedMasteries(jobId, weaponType)
  if (applied.length > 0) return applied
  const all = jobMasteries(jobId)
  const fallback = (jobId ? DEFAULT_MASTERY_WEAPON[jobId] : undefined) ?? all[0]?.weaponTypes?.[0]
  if (!fallback) return all
  return all.filter((b) => b.weaponTypes?.includes(fallback))
}

export interface BuffContext {
  activeBuffs: Record<string, number>
  appliedBuffs: Record<string, number>
  masteryLevels: Record<string, number>
  /** 비활성화한 무기 마스터리 (있으면 자동 적용에서 제외) */
  masteryOff?: Record<string, boolean>
  jobId: JobId | null
  weaponType?: WeaponType
  /** 방패 착용 여부 (requiresShield 버프 게이팅) */
  hasShield?: boolean
}

/** 전개된 버프 한 항목 — 게이팅/레벨 클램프까지 끝나고 들어갈 풀이 확정된 상태 */
export interface BuffEntry {
  buff: Buff
  /** 클램프 후 실제 적용 레벨 */
  level: number
  effects: EffectMap
  /** sum = 단순 합산 / max = 능력치별 최댓값 경쟁 풀 */
  pool: 'sum' | 'max'
  /** 조건부 버프(스턴 마스터리 등) — 상시 합산에서 빠지고 해당 상황 계산에서만 쓰인다 */
  conditional?: BuffCondition
}

/**
 * 활성 버프 전개 — 게이팅·레벨 클램프·풀 분류를 끝낸 항목 목록.
 *  - activeBuffs(토글): 영메·메용 + 직업특화 패시브 → 합산 풀
 *  - appliedBuffs(적용 목록: 도핑/개인/파티) → 최댓값 풀
 *    (같은 종류 버프는 중첩되지 않고 높은 쪽만 적용)
 *  - nonStacking 토글(해적 에너지 차지 등): 특화 섹션에 있지만 도핑/개인/파티와
 *    중첩되지 않으므로, 합산이 아니라 최댓값 풀에 함께 넣는다.
 *  - 무기 마스터리/엑스퍼트: 장착 주무기 타입이 일치할 때만 자동 적용(레벨=masteryLevels[id] ?? 마스터)
 *
 * 합산(activeBuffEffects)과 기여 요소 표시(resourceSources)가 이 한 목록을 공유해
 * 두 곳의 규칙이 갈라지지 않게 한다.
 */
export function activeBuffEntries(ctx: BuffContext): BuffEntry[] {
  const { activeBuffs, appliedBuffs, masteryLevels, masteryOff, jobId, weaponType, hasShield } = ctx
  const out: BuffEntry[] = []
  // 토글 버프 (무기 게이팅 버프는 여기서 제외 — 아래서 따로 처리)
  for (const [id, level] of Object.entries(activeBuffs)) {
    const b = getBuff(id)
    if (!b || (b.type === 'skill' && b.weaponTypes)) continue
    // 방패 필요 버프(블로킹)는 방패 미착용 시 제외
    if (b.type === 'skill' && b.requiresShield && !hasShield) continue
    // 직업 상한(정령의 축복: 모험가 12) 초과 저장분 클램프
    const lv = Math.min(level, effectiveMasterLevel(b, jobId))
    const nonStacking = b.type === 'skill' && b.nonStacking
    const conditional = b.type === 'skill' ? b.conditional : undefined
    out.push({ buff: b, level: lv, effects: buffEffectsAtLevel(b, lv), pool: nonStacking ? 'max' : 'sum', conditional })
  }
  // 무기 마스터리/엑스퍼트 — 장착 주무기 일치 시 자동 적용 (off한 것은 제외)
  for (const b of appliedMasteries(jobId, weaponType)) {
    if (masteryOff?.[b.id]) continue
    const lv = masteryLevels[b.id] ?? b.masterLevel
    out.push({ buff: b, level: lv, effects: buffEffectsAtLevel(b, lv), pool: 'sum' })
  }
  // 적용 버프(도핑/개인/파티) — 능력치별 최댓값 적용.
  // 무기 부스터처럼 weaponTypes가 붙은 버프는 장착 주무기가 맞을 때만 들어간다.
  for (const [id, level] of Object.entries(appliedBuffs)) {
    const b = getBuff(id)
    if (!b || !weaponGateOk(b, weaponType)) continue
    out.push({ buff: b, level, effects: buffEffectsAtLevel(b, level), pool: 'max' })
  }
  return out
}

/**
 * 활성 버프 → 합산 EffectMap (합산 풀은 덧셈, 최댓값 풀은 능력치별 최댓값).
 * 조건부 버프(스턴 마스터리)는 상시 효과가 아니라 여기서 빠진다 — conditionalBuffEffects 참고.
 */
export function activeBuffEffects(ctx: BuffContext): EffectMap {
  const entries = activeBuffEntries(ctx).filter((e) => !e.conditional)
  return sumEffects(
    ...entries.filter((e) => e.pool === 'sum').map((e) => e.effects),
    maxEffects(...entries.filter((e) => e.pool === 'max').map((e) => e.effects)),
  )
}

/**
 * 특정 조건의 버프만 합산한 EffectMap.
 * 그 상황을 가정하는 계산(예: 스턴 상태를 때리는 '(스턴)' 스킬)에서 상시 효과 위에 더해 쓴다.
 */
export function conditionalBuffEffects(ctx: BuffContext, condition: BuffCondition): EffectMap {
  return sumEffects(
    ...activeBuffEntries(ctx)
      .filter((e) => e.conditional === condition)
      .map((e) => e.effects),
  )
}

/** HP/MP에 기여하는 요소 하나 (기본 HP 입력 다이얼로그의 아이콘 목록용) */
export interface ResourceSource {
  /** 리스트 key (장비는 인스턴스 id, 버프는 buff id) */
  key: string
  name: string
  /** 장비 아이콘 URL. 버프는 buff를 넘겨 UI에서 직업별 아이콘까지 해석한다 */
  iconUrl?: string
  buff?: Buff
  /** 실제로 반영되는 HP/MP 기여분 (최댓값 풀에서 밀린 버프는 그 항목이 빠진다) */
  effects: EffectMap
}

/** EffectMap에서 HP/MP 관련 항목만 추린다 (0은 제외) */
function pickResourceEffects(effects: EffectMap): EffectMap {
  const out: EffectMap = {}
  for (const id of RESOURCE_IDS) {
    const v = effects[id]
    if (v) out[id] = v
  }
  return out
}

/**
 * 현재 HP/MP에 영향을 주는 요소 목록 (장착 장비 + 활성 버프).
 *
 * 최댓값 풀(도핑/개인/파티)은 같은 효과가 여럿이어도 가장 높은 하나만 실제로 반영되므로,
 * 효과 id별 승자에게만 그 값을 붙이고 나머지에서는 지운다 — 합계가 이중으로 잡히지 않게.
 * 장비의 finalEffects에는 보석(토파즈 등)·주문서·수치조정이 이미 녹아 있다.
 */
export function resourceSources(builts: BuiltItem[], ctx: BuffContext): ResourceSource[] {
  const out: ResourceSource[] = []
  for (const b of builts) {
    const eff = pickResourceEffects(resolveBuiltItem(b).finalEffects)
    if (Object.keys(eff).length > 0) {
      out.push({ key: `item:${b.base.id}:${out.length}`, name: b.base.name, iconUrl: b.base.iconUrl, effects: eff })
    }
  }

  // 조건부 버프는 상시 효과가 아니라 HP/MP 기여 목록에서도 뺀다 (activeBuffEffects와 같은 규칙)
  const entries = activeBuffEntries(ctx).filter((e) => !e.conditional)
  const maxEntries = entries.filter((e) => e.pool === 'max')
  // 효과 id별 최댓값 승자 — 동률이면 먼저 온 쪽
  const winner = new Map<EffectId, BuffEntry>()
  for (const id of RESOURCE_IDS) {
    let best: BuffEntry | undefined
    for (const e of maxEntries) {
      if ((e.effects[id] ?? 0) > (best?.effects[id] ?? 0)) best = e
    }
    if (best) winner.set(id, best)
  }
  for (const e of entries) {
    const eff = pickResourceEffects(e.effects)
    if (e.pool === 'max') {
      for (const id of Object.keys(eff) as EffectId[]) {
        if (winner.get(id) !== e) delete eff[id]
      }
    }
    if (Object.keys(eff).length > 0) out.push({ key: `buff:${e.buff.id}`, name: e.buff.name, buff: e.buff, effects: eff })
  }
  return out
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
