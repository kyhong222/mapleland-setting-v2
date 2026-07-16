/**
 * 리버스/타임리스 장비의 아이템 레벨업(성장) 기믹.
 *
 * 일반 장비는 변동옵 + 주문서(업횟)로 강화하지만, 리버스/타임리스 장비는
 * 캐릭터 성장에 따라 레벨업으로 추가 강화된다.
 *  - 리버스  : 3레벨 / 타임리스 : 5레벨
 *  - 레벨업당 상승폭은 가변이므로(스탯별 min~max), 세팅 시뮬레이션에서는
 *    사용자가 누적 성장치를 [총min ~ 총max] 범위로 직접 입력한다.
 *
 * 성장 범위 데이터 출처: https://maplekibun.tistory.com/762
 * (카테고리 = 아이템 1:1 이므로 무기종류/부위별 표가 곧 아이템별 데이터)
 */

import type { EffectId, EffectMap } from './effects'
import type { ItemData } from './item'
import type { SlotId } from './equipSlots'
import type { WeaponType } from './weapons'

export type GrowthTier = 'reverse' | 'timeless'

export const GROWTH_TIER_LABEL: Record<GrowthTier, string> = {
  reverse: '리버스',
  timeless: '타임리스',
}

/** 티어별 최대 레벨업 횟수 */
export const GROWTH_MAX_LEVEL: Record<GrowthTier, number> = {
  reverse: 3,
  timeless: 5,
}

/** 스탯별 레벨업 1회당 상승 범위 */
export interface GrowthRange {
  effectId: EffectId
  perLevelMin: number
  perLevelMax: number
}

// ── 무기 종류별 레벨업 1회당 성장 범위 ──
const WARRIOR_WEAPON: GrowthRange[] = [
  { effectId: 'pad', perLevelMin: 0, perLevelMax: 2 },
  { effectId: 'STR', perLevelMin: 1, perLevelMax: 2 },
  { effectId: 'DEX', perLevelMin: 0, perLevelMax: 1 },
]
const MAGE_WEAPON: GrowthRange[] = [
  { effectId: 'mad', perLevelMin: 1, perLevelMax: 4 },
  { effectId: 'INT', perLevelMin: 1, perLevelMax: 2 },
  { effectId: 'LUK', perLevelMin: 0, perLevelMax: 1 },
]
const DEX_WEAPON: GrowthRange[] = [ // 활/석궁/건
  { effectId: 'pad', perLevelMin: 0, perLevelMax: 2 },
  { effectId: 'DEX', perLevelMin: 1, perLevelMax: 2 },
  { effectId: 'STR', perLevelMin: 0, perLevelMax: 1 },
]
const LUK_WEAPON: GrowthRange[] = [ // 럭단검/아대/블레이드
  { effectId: 'pad', perLevelMin: 0, perLevelMax: 2 },
  { effectId: 'LUK', perLevelMin: 1, perLevelMax: 2 },
  { effectId: 'DEX', perLevelMin: 0, perLevelMax: 1 },
]

const WEAPON_GROWTH: Partial<Record<WeaponType, GrowthRange[]>> = {
  oneHandedSword: WARRIOR_WEAPON,
  twoHandedSword: WARRIOR_WEAPON,
  oneHandedAxe: WARRIOR_WEAPON,
  twoHandedAxe: WARRIOR_WEAPON,
  oneHandedMace: WARRIOR_WEAPON,
  twoHandedMace: WARRIOR_WEAPON,
  spear: WARRIOR_WEAPON,
  polearm: WARRIOR_WEAPON,
  knuckle: WARRIOR_WEAPON,
  staff: MAGE_WEAPON,
  wand: MAGE_WEAPON,
  bow: DEX_WEAPON,
  crossbow: DEX_WEAPON,
  gun: DEX_WEAPON,
  // 단검은 럭단검 기준. 힘단검(페스카즈, STR+0~1)은 아이템 추가 시 개별 지정.
  dagger: LUK_WEAPON,
  claw: LUK_WEAPON,
}

// ── 장신구(귀고리/망토) 레벨업 1회당 성장 범위 ──
const ACCESSORY_GROWTH: GrowthRange[] = [
  { effectId: 'STR', perLevelMin: 0, perLevelMax: 1 },
  { effectId: 'DEX', perLevelMin: 0, perLevelMax: 1 },
  { effectId: 'INT', perLevelMin: 0, perLevelMax: 1 },
  { effectId: 'LUK', perLevelMin: 0, perLevelMax: 1 },
  { effectId: 'speed', perLevelMin: 0, perLevelMax: 2 },
  { effectId: 'jump', perLevelMin: 0, perLevelMax: 1 },
]

const ACCESSORY_SLOTS: SlotId[] = ['earring', 'cape']

// ── 방어구 레벨업 1회당 성장 범위 (직업별) ──
type ArmorClass = 'warrior' | 'magician' | 'bowman' | 'thief' | 'pirate'

/** reqJob 비트마스크 → 직업 계열 (방어구는 단일 직업) */
const ARMOR_CLASS_BY_REQJOB: Record<number, ArmorClass> = { 1: 'warrior', 2: 'magician', 4: 'bowman', 8: 'thief', 16: 'pirate' }

const g = (effectId: EffectId, perLevelMin: number, perLevelMax: number): GrowthRange => ({ effectId, perLevelMin, perLevelMax })

const HAT_GROWTH: Record<ArmorClass, GrowthRange[]> = {
  warrior: [g('STR', 0, 1), g('DEX', 0, 1), g('hp', 10, 20)],
  magician: [g('INT', 0, 1), g('LUK', 0, 1), g('hp', 5, 10), g('mp', 5, 10)],
  bowman: [g('STR', 0, 1), g('DEX', 0, 1), g('hp', 20, 30)],
  thief: [g('STR', 0, 1), g('DEX', 0, 1), g('LUK', 0, 1), g('hp', 20, 30)],
  pirate: [g('STR', 0, 1), g('DEX', 0, 1), g('hp', 10, 20)],
}
// 상의/전신 공용
const BODY_GROWTH: Record<ArmorClass, GrowthRange[]> = {
  warrior: [g('STR', 0, 1), g('DEX', 0, 1), g('eva', 1, 2)],
  magician: [g('INT', 0, 1), g('LUK', 0, 1), g('eva', 1, 2)],
  bowman: [g('STR', 0, 1), g('DEX', 0, 1), g('eva', 1, 3)],
  thief: [g('STR', 0, 1), g('DEX', 0, 1), g('LUK', 0, 1), g('eva', 1, 3)],
  pirate: [g('STR', 0, 1), g('DEX', 0, 1), g('eva', 1, 3)],
}
const GLOVES_GROWTH: Record<ArmorClass, GrowthRange[]> = {
  warrior: [g('STR', 0, 1), g('DEX', 0, 1), g('acc', 1, 2)],
  magician: [g('mad', 0, 1), g('INT', 0, 1), g('LUK', 0, 1)],
  bowman: [g('STR', 0, 1), g('DEX', 0, 1), g('hp', 5, 10)],
  thief: [g('STR', 0, 1), g('DEX', 0, 1), g('LUK', 0, 1), g('hp', 5, 10)],
  pirate: [g('STR', 0, 1), g('DEX', 0, 1), g('hp', 5, 10)],
}
const SHOES_GROWTH: Record<ArmorClass, GrowthRange[]> = {
  warrior: [g('STR', 0, 1), g('DEX', 0, 1), g('speed', 0, 1), g('jump', 0, 1)],
  magician: [g('INT', 0, 1), g('LUK', 0, 1), g('speed', 0, 1), g('jump', 0, 1)],
  bowman: [g('STR', 0, 1), g('DEX', 0, 1), g('speed', 0, 1), g('jump', 0, 1)],
  thief: [g('STR', 0, 1), g('DEX', 0, 1), g('LUK', 0, 1), g('speed', 0, 1), g('jump', 0, 1)],
  pirate: [g('STR', 0, 1), g('DEX', 0, 1), g('speed', 0, 1), g('jump', 0, 1)],
}
// 방패는 전사/법사/도적만 존재
const SHIELD_GROWTH: Partial<Record<ArmorClass, GrowthRange[]>> = {
  warrior: [g('pdef', 5, 10), g('STR', 0, 1), g('DEX', 0, 1)],
  magician: [g('pdef', 5, 10), g('mdef', 5, 10), g('INT', 0, 1), g('LUK', 0, 1)],
  thief: [g('pdef', 5, 10), g('STR', 0, 1), g('DEX', 0, 1), g('LUK', 1, 1)],
}

const ARMOR_GROWTH: Partial<Record<SlotId, Partial<Record<ArmorClass, GrowthRange[]>>>> = {
  hat: HAT_GROWTH,
  top: BODY_GROWTH,
  bottom: BODY_GROWTH,
  overall: BODY_GROWTH,
  gloves: GLOVES_GROWTH,
  shoes: SHOES_GROWTH,
  shield: SHIELD_GROWTH,
}

/** 이름 접두사로 성장 티어 판별 ("타임리스 …" / "리버스 …") */
export function growthTier(name: string): GrowthTier | null {
  if (/^타임리스\s/.test(name)) return 'timeless'
  if (/^리버스\s/.test(name)) return 'reverse'
  return null
}

/** 부위/무기종류/직업에 해당하는 레벨업 성장 범위 (미정의면 null) */
function growthRangesFor(item: ItemData): GrowthRange[] | null {
  if (item.slot === 'weapon' && item.weaponType) return WEAPON_GROWTH[item.weaponType] ?? null
  if (ACCESSORY_SLOTS.includes(item.slot)) return ACCESSORY_GROWTH
  const armor = ARMOR_GROWTH[item.slot]
  if (armor) {
    const cls = ARMOR_CLASS_BY_REQJOB[item.reqJob ?? 0]
    return (cls && armor[cls]) ?? null
  }
  return null
}

/** 스탯별 성장 스펙(레벨당 + 누적 범위) */
export interface GrowthStat extends GrowthRange {
  /** 누적 최소 = perLevelMin × maxLevel */
  totalMin: number
  /** 누적 최대 = perLevelMax × maxLevel */
  totalMax: number
}

export interface GrowthSpec {
  tier: GrowthTier
  maxLevel: number
  stats: GrowthStat[]
}

/** 아이템의 성장 스펙 (성장 불가면 null) */
export function itemGrowthSpec(item: ItemData): GrowthSpec | null {
  const tier = growthTier(item.name)
  if (!tier) return null
  const ranges = growthRangesFor(item)
  if (!ranges) return null
  const maxLevel = GROWTH_MAX_LEVEL[tier]
  const stats: GrowthStat[] = ranges.map((r) => ({
    ...r,
    totalMin: r.perLevelMin * maxLevel,
    totalMax: r.perLevelMax * maxLevel,
  }))
  return { tier, maxLevel, stats }
}

/** 성장 값(EffectMap)을 스펙 범위 [totalMin, totalMax]로 클램프하고 스펙 외 스탯은 제거 */
export function clampGrowth(spec: GrowthSpec, growth: EffectMap): EffectMap {
  const out: EffectMap = {}
  for (const st of spec.stats) {
    const v = growth[st.effectId]
    if (v === undefined) continue
    out[st.effectId] = Math.max(st.totalMin, Math.min(st.totalMax, Math.floor(v)))
  }
  return out
}
