/**
 * 메이커 도메인 — 보석(gem) 적용.
 *
 * 아이템 제작 흐름: 카탈로그 선택/수치조정 → 주문서 강화 → (여기) 보석 적용.
 *
 * 규칙:
 *  - 한 장비에 보석 최대 3개. 같은 종류(GemType)는 등급 무관 1개만(상급 가넷+하급 가넷 불가).
 *  - 슬롯별 장착 가능 수 = 0 또는 3 (GEM_SLOT_CAPACITY, 추후 변경 가능).
 *  - 다이아몬드·사파이어는 무기 전용.
 */

import type { EffectId, EffectMap } from './effects'
import { sumEffects } from './effects'
import type { SlotId } from './equipSlots'

/** 보석 등급 (하급/중급/상급) */
export type GemGrade = 'low' | 'mid' | 'high'
export const GEM_GRADES: readonly GemGrade[] = ['low', 'mid', 'high']
export const GEM_GRADE_LABELS: Record<GemGrade, string> = {
  low: '하급',
  mid: '중급',
  high: '상급',
}

export type GemType =
  | 'diamond'
  | 'sapphire'
  | 'topaz'
  | 'emerald'
  | 'amethyst'
  | 'aquamarine'
  | 'garnet'
  | 'opal'
  | 'strCrystal'
  | 'dexCrystal'
  | 'intCrystal'
  | 'lukCrystal'

export interface GemDef {
  type: GemType
  /** 한글명 (예: 가넷) */
  label: string
  /** 부여 효과 */
  effectId: EffectId
  /** 등급별 수치 */
  values: Record<GemGrade, number>
  /** 무기 전용 여부 (다이아몬드/사파이어) */
  weaponOnly: boolean
  /** 하급(Basic) 게임 아이템 id. 중급=+1, 상급=+2 (GMS 82 maker, 아이콘용) */
  iconBaseId: number
}

export const GEMS: Record<GemType, GemDef> = {
  diamond: { type: 'diamond', label: '다이아몬드', effectId: 'pad', values: { low: 1, mid: 2, high: 3 }, weaponOnly: true, iconBaseId: 4250000 },
  sapphire: { type: 'sapphire', label: '사파이어', effectId: 'mad', values: { low: 1, mid: 2, high: 3 }, weaponOnly: true, iconBaseId: 4250100 },
  topaz: { type: 'topaz', label: '토파즈', effectId: 'hp', values: { low: 10, mid: 20, high: 30 }, weaponOnly: false, iconBaseId: 4250600 },
  emerald: { type: 'emerald', label: '에메랄드', effectId: 'mp', values: { low: 10, mid: 20, high: 30 }, weaponOnly: false, iconBaseId: 4250700 },
  amethyst: { type: 'amethyst', label: '자수정', effectId: 'speed', values: { low: 1, mid: 3, high: 5 }, weaponOnly: false, iconBaseId: 4250400 },
  aquamarine: { type: 'aquamarine', label: '아쿠아마린', effectId: 'jump', values: { low: 1, mid: 2, high: 3 }, weaponOnly: false, iconBaseId: 4250500 },
  garnet: { type: 'garnet', label: '가넷', effectId: 'add', values: { low: 1, mid: 3, high: 5 }, weaponOnly: false, iconBaseId: 4250200 },
  opal: { type: 'opal', label: '오팔', effectId: 'eva', values: { low: 1, mid: 3, high: 5 }, weaponOnly: false, iconBaseId: 4250300 },
  strCrystal: { type: 'strCrystal', label: '힘의 크리스탈', effectId: 'STR', values: { low: 1, mid: 3, high: 5 }, weaponOnly: false, iconBaseId: 4250800 },
  dexCrystal: { type: 'dexCrystal', label: '민첩의 크리스탈', effectId: 'DEX', values: { low: 1, mid: 3, high: 5 }, weaponOnly: false, iconBaseId: 4251100 },
  intCrystal: { type: 'intCrystal', label: '지혜의 크리스탈', effectId: 'INT', values: { low: 1, mid: 3, high: 5 }, weaponOnly: false, iconBaseId: 4250900 },
  lukCrystal: { type: 'lukCrystal', label: '행운의 크리스탈', effectId: 'LUK', values: { low: 1, mid: 3, high: 5 }, weaponOnly: false, iconBaseId: 4251000 },
}

const GRADE_OFFSET: Record<GemGrade, number> = { low: 0, mid: 1, high: 2 }

/** 보석 아이콘 URL (GMS 82 maker 아이템) */
export function gemIconUrl(type: GemType, grade: GemGrade): string {
  return `https://maplestory.io/api/gms/82/item/${GEMS[type].iconBaseId + GRADE_OFFSET[grade]}/icon`
}

export const ALL_GEMS: GemDef[] = Object.values(GEMS)

/** 슬롯별 보석 장착 가능 개수 (0 또는 3, 추후 변경 가능) */
export const GEM_SLOT_CAPACITY: Record<SlotId, number> = {
  hat: 3,
  overall: 3,
  top: 3,
  bottom: 3,
  gloves: 3,
  shoes: 3,
  shield: 3,
  weapon: 3,
  // 적용 불가
  cape: 0,
  earring: 0,
  pendant: 0,
  eyeAccessory: 0,
  faceAccessory: 0,
  ring: 0,
  belt: 0,
  petAcc: 0,
  medal: 0,
  // 투사체(강화 불가)
  arrow: 0,
  bolt: 0,
  throwingStar: 0,
  bullet: 0,
  capsule: 0,
}

/** 장착할 보석 1개 선택 */
export interface GemSelection {
  type: GemType
  grade: GemGrade
}

/** 슬롯의 보석 장착 가능 개수 */
export function gemCapacity(slot: SlotId): number {
  return GEM_SLOT_CAPACITY[slot]
}

/** 슬롯에 보석을 장착할 수 있는지 */
export function canEquipGems(slot: SlotId): boolean {
  return gemCapacity(slot) > 0
}

/** 해당 슬롯에 적용 가능한 보석 목록 (무기 전용 보석은 무기에서만) */
export function gemsForSlot(slot: SlotId): GemDef[] {
  if (!canEquipGems(slot)) return []
  return ALL_GEMS.filter((g) => !g.weaponOnly || slot === 'weapon')
}

/** 보석 1개의 효과 */
export function gemEffect(type: GemType, grade: GemGrade): EffectMap {
  const def = GEMS[type]
  const effects: EffectMap = {}
  effects[def.effectId] = def.values[grade]
  return effects
}

/** 선택한 보석들의 합산 효과 */
export function applyGems(selections: GemSelection[]): EffectMap {
  return sumEffects(...selections.map((s) => gemEffect(s.type, s.grade)))
}

export interface GemValidation {
  ok: boolean
  errors: string[]
}

/**
 * 슬롯 + 보석 선택이 규칙에 맞는지 검증.
 *  - 개수 ≤ 슬롯 용량
 *  - 같은 종류 중복 불가
 *  - 무기 전용 보석은 무기에만
 */
export function validateGems(
  slot: SlotId,
  selections: GemSelection[],
): GemValidation {
  const errors: string[] = []
  const cap = gemCapacity(slot)
  if (cap === 0 && selections.length > 0) {
    errors.push('이 부위에는 보석을 장착할 수 없습니다.')
  } else if (selections.length > cap) {
    errors.push(`보석은 최대 ${cap}개까지 장착할 수 있습니다.`)
  }
  const seen = new Set<GemType>()
  for (const sel of selections) {
    if (seen.has(sel.type)) {
      errors.push(`같은 종류의 보석(${GEMS[sel.type].label})은 1개만 장착할 수 있습니다.`)
    }
    seen.add(sel.type)
    if (GEMS[sel.type].weaponOnly && slot !== 'weapon') {
      errors.push(`${GEMS[sel.type].label}은(는) 무기에만 장착할 수 있습니다.`)
    }
  }
  return { ok: errors.length === 0, errors }
}
