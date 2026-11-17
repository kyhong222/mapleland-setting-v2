import { SLOTS } from '../domain/equipSlots'
import { WEAPON_CONSTANTS } from '../domain/weapons'
import type { ItemData } from '../domain/item'

/**
 * 아이템의 장비분류 표기 — 무기는 '무기' 대신 무기 종류(스태프·완드·한손검 …)를 쓴다.
 * 그 외 부위는 부위 이름 그대로. 무기 종류를 모르는 무기는 '무기'로 둔다.
 * (장착 칸 이름이 필요한 곳 — 저장슬롯 미리보기 등 — 은 SLOTS[slot].label을 그대로 쓸 것)
 */
export function equipCategoryLabel(item: Pick<ItemData, 'slot' | 'weaponType'>): string {
  if (item.slot === 'weapon' && item.weaponType) return WEAPON_CONSTANTS[item.weaponType]?.label ?? SLOTS.weapon.label
  return SLOTS[item.slot].label
}
