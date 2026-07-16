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

/** 이름 접두사로 성장 티어 판별 ("타임리스 …" / "리버스 …") */
export function growthTier(name: string): GrowthTier | null {
  if (/^타임리스\s/.test(name)) return 'timeless'
  if (/^리버스\s/.test(name)) return 'reverse'
  return null
}

/** 부위/무기종류에 해당하는 레벨업 성장 범위 (미정의면 null) */
function growthRangesFor(item: ItemData): GrowthRange[] | null {
  if (item.slot === 'weapon' && item.weaponType) return WEAPON_GROWTH[item.weaponType] ?? null
  if (ACCESSORY_SLOTS.includes(item.slot)) return ACCESSORY_GROWTH
  // 방어구 등은 데이터 추가 시 확장
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
