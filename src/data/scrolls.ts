/**
 * 주문서 데이터 로더.
 *
 * 표준(100/60/10) 주문서 번들 데이터(src/data/scrolls.json, `node scripts/buildScrolls.mjs` 생성)를
 * 로드하고 부위/무기/아이템 단위 조회 헬퍼를 제공한다.
 */

import type { ScrollDef } from '../domain/scrolls'
import type { SlotId } from '../domain/equipSlots'
import type { WeaponType } from '../domain/weapons'
import type { ItemData } from '../domain/item'
import scrollsJson from './scrolls.json'

export const SCROLLS: ScrollDef[] = scrollsJson as unknown as ScrollDef[]

const BY_KEY: ReadonlyMap<string, ScrollDef> = new Map(
  SCROLLS.map((s) => [s.key, s]),
)

export function getScroll(key: string): ScrollDef | undefined {
  return BY_KEY.get(key)
}

/** 해당 부위(방어구/장신구)에 바를 수 있는 주문서 */
export function listScrollsForSlot(slot: SlotId): ScrollDef[] {
  return SCROLLS.filter((s) => s.slot === slot)
}

/** 해당 무기 종류에 바를 수 있는 주문서 */
export function listScrollsForWeaponType(weaponType: WeaponType): ScrollDef[] {
  return SCROLLS.filter((s) => s.weaponType === weaponType)
}

/**
 * 특정 아이템에 바를 수 있는 주문서.
 *  - itemIds 전용 주문서(커스텀) 매칭
 *  - 무기: weaponType 일치, 그 외: slot 일치
 */
export function listScrollsForItem(item: ItemData): ScrollDef[] {
  return SCROLLS.filter((s) => {
    if (s.itemIds?.includes(item.id)) return true
    if (item.slot === 'weapon') {
      return item.weaponType != null && s.weaponType === item.weaponType
    }
    return s.slot === item.slot
  })
}
