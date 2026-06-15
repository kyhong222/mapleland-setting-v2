/**
 * maplestory.io typeInfo.subCategory → 도메인 SlotId / WeaponType 매핑.
 * (실제 GMS 62/200 응답을 조사해 확정한 문자열)
 */

import type { SlotId } from '../domain/equipSlots'
import type { WeaponType } from '../domain/weapons'

/** 방어구/장신구 subCategory → 부위 */
export const SLOT_BY_SUBCATEGORY: Record<string, SlotId> = {
  Hat: 'hat',
  'Face Accessory': 'faceAccessory',
  'Eye Decoration': 'eyeAccessory',
  Earrings: 'earring',
  Top: 'top',
  Bottom: 'bottom',
  Overall: 'overall',
  Shoes: 'shoes',
  Glove: 'gloves',
  Cape: 'cape',
  Shield: 'shield',
  Ring: 'ring',
  Pendant: 'pendant',
  Medal: 'medal',
}

/** 무기 subCategory → 무기 종류 */
export const WEAPONTYPE_BY_SUBCATEGORY: Record<string, WeaponType> = {
  'One-Handed Sword': 'oneHandedSword',
  'One-Handed Axe': 'oneHandedAxe',
  'One-Handed Blunt Weapon': 'oneHandedMace',
  'Two-Handed Sword': 'twoHandedSword',
  'Two-Handed Axe': 'twoHandedAxe',
  'Two-Handed Blunt': 'twoHandedMace',
  Spear: 'spear',
  'Pole Arm': 'polearm',
  Dagger: 'dagger',
  Claw: 'claw',
  Bow: 'bow',
  Crossbow: 'crossbow',
  Knuckle: 'knuckle',
  Gun: 'gun',
  Wand: 'wand',
  Staff: 'staff',
}

/**
 * subCategory로 부위를 해석한다.
 * - 방어구/장신구: 직접 매핑
 * - 무기류: 'weapon'
 * - 그 외(소비/기타 등): null
 */
export function resolveSlot(subCategory: string | undefined): SlotId | null {
  if (!subCategory) return null
  if (subCategory in SLOT_BY_SUBCATEGORY) return SLOT_BY_SUBCATEGORY[subCategory]
  if (subCategory in WEAPONTYPE_BY_SUBCATEGORY) return 'weapon'
  return null
}

/** subCategory로 무기 종류를 해석한다(무기가 아니면 undefined). */
export function resolveWeaponType(
  subCategory: string | undefined,
): WeaponType | undefined {
  if (!subCategory) return undefined
  return WEAPONTYPE_BY_SUBCATEGORY[subCategory]
}
