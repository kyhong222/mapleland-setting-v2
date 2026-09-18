/**
 * 아이템 레벨업(성장) 기믹.
 *
 * 일반 장비는 변동옵 + 주문서(업횟)로 강화하지만, 일부 장비는 캐릭터 성장에 따라
 * 레벨업으로 추가 강화된다. 판별 경로가 둘이다.
 *  - 이름 접두사 — "리버스 …"(3레벨) / "타임리스 …"(5레벨). 부위·무기종류·직업으로 표를 고른다.
 *  - 아이템 단위 — 이름 규칙이 없는 개별 기믹(`ITEM_GROWTH`). 메랜 오리지널 조정분이 여기 온다.
 *
 * 레벨업당 상승폭은 대개 가변이라(스탯별 min~max) 사용자가 누적 성장치를
 * [총min ~ 총max] 범위로 직접 입력한다. 반대로 상승폭이 고정(min === max)이면
 * 누적치가 레벨에서 일의적으로 정해지므로 `GrowthSpec.fixed`로 표시하고 UI는
 * 스탯별 입력 대신 레벨 하나만 받는다.
 *
 * 성장 범위 데이터 출처: https://maplekibun.tistory.com/762
 * (카테고리 = 아이템 1:1 이므로 무기종류/부위별 표가 곧 아이템별 데이터)
 */

import type { EffectId, EffectMap } from './effects'
import type { ItemData } from './item'
import type { SlotId } from './equipSlots'
import type { WeaponType } from './weapons'

/** 이름 접두사로 판별되는 티어 */
export type NameGrowthTier = 'reverse' | 'timeless'
/** 이름 규칙 없이 아이템 단위로 붙는 기믹 = 'itemLevel' */
export type GrowthTier = NameGrowthTier | 'itemLevel'

export const GROWTH_TIER_LABEL: Record<GrowthTier, string> = {
  reverse: '리버스',
  timeless: '타임리스',
  itemLevel: '아이템 레벨업',
}

/** 이름 접두사 티어별 최대 레벨업 횟수 (아이템 단위 기믹은 각자 maxLevel을 가진다) */
export const GROWTH_MAX_LEVEL: Record<NameGrowthTier, number> = {
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

// ── 아이템 단위 성장 기믹 (이름 규칙에 걸리지 않는 개별 아이템) ──
interface ItemGrowthDef {
  maxLevel: number
  ranges: GrowthRange[]
}

const ITEM_GROWTH: Record<number, ItemGrowthDef> = {
  // 월묘 견장 — 원작은 공2/마력2지만 메랜은 올스탯 5 + 레벨업 기믹으로 바뀌었다.
  // 레벨업 1회당 올스탯 +1 고정, 5레벨까지.
  1152052: {
    maxLevel: 5,
    ranges: [g('STR', 1, 1), g('DEX', 1, 1), g('INT', 1, 1), g('LUK', 1, 1)],
  },
}

/** 이름 접두사로 성장 티어 판별 ("타임리스 …" / "리버스 …") */
export function growthTier(name: string): NameGrowthTier | null {
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
  /**
   * 누적 최소 = 0. 아직 한 번도 레벨업하지 않은 상태가 있을 수 있어
   * perLevelMin × maxLevel로 잡으면 안 된다.
   * (예: 리버스 무기 주스탯은 레벨당 1~2지만 0레벨이면 0이므로 0~6이 맞다)
   */
  totalMin: number
  /** 누적 최대 = perLevelMax × maxLevel (전 레벨 최대치로 올랐을 때) */
  totalMax: number
}

export interface GrowthSpec {
  tier: GrowthTier
  maxLevel: number
  stats: GrowthStat[]
  /**
   * 모든 스탯의 레벨당 상승폭이 고정(min === max)이라 누적치가 레벨 하나로 결정되는지.
   * true면 UI가 스탯별 입력 대신 레벨만 받는다 (스탯끼리 어긋난 조합을 막기 위함).
   */
  fixed: boolean
}

function toSpec(tier: GrowthTier, maxLevel: number, ranges: GrowthRange[]): GrowthSpec {
  const stats: GrowthStat[] = ranges.map((r) => ({
    ...r,
    totalMin: 0,
    totalMax: r.perLevelMax * maxLevel,
  }))
  return { tier, maxLevel, stats, fixed: ranges.every((r) => r.perLevelMin === r.perLevelMax) }
}

/** 아이템의 성장 스펙 (성장 불가면 null) */
export function itemGrowthSpec(item: ItemData): GrowthSpec | null {
  // 아이템 단위 기믹이 이름 규칙보다 우선한다.
  const own = ITEM_GROWTH[item.id]
  if (own) return toSpec('itemLevel', own.maxLevel, own.ranges)

  const tier = growthTier(item.name)
  if (!tier) return null
  const ranges = growthRangesFor(item)
  if (!ranges) return null
  return toSpec(tier, GROWTH_MAX_LEVEL[tier], ranges)
}

/** 고정 성장 스펙에서 레벨 → 누적 성장 EffectMap */
export function growthAtLevel(spec: GrowthSpec, level: number): EffectMap {
  const lv = Math.max(0, Math.min(spec.maxLevel, Math.floor(level)))
  const out: EffectMap = {}
  for (const st of spec.stats) out[st.effectId] = st.perLevelMin * lv
  return out
}

/**
 * 고정 성장 스펙에서 누적 EffectMap → 레벨 역산.
 * 스탯별로 어긋나 있으면(수동 편집/구버전 데이터) 가장 큰 레벨을 택한다.
 */
export function growthLevelOf(spec: GrowthSpec, growth: EffectMap): number {
  let lv = 0
  for (const st of spec.stats) {
    if (st.perLevelMin <= 0) continue
    lv = Math.max(lv, Math.floor((growth[st.effectId] ?? 0) / st.perLevelMin))
  }
  return Math.max(0, Math.min(spec.maxLevel, lv))
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
