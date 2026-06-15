/**
 * 로컬 아이템 카탈로그.
 *
 * v1(kyhong222/mapleland-setting)의 pre/post 데이터를 v2 ItemData로 변환한 번들 데이터.
 * (생성: `node scripts/convertV1.mjs` → src/data/catalog/<slot>.json)
 *
 * itemRepository가 API보다 먼저 이 카탈로그를 조회한다(로컬 우선 → API 폴백).
 * 재생성하려면 변환 스크립트를 다시 실행하면 된다.
 */

import type { ItemData } from '../domain/item'
import type { SlotId } from '../domain/equipSlots'

import hat from './catalog/hat.json'
import faceAccessory from './catalog/faceAccessory.json'
import eyeAccessory from './catalog/eyeAccessory.json'
import earring from './catalog/earring.json'
import top from './catalog/top.json'
import bottom from './catalog/bottom.json'
import overall from './catalog/overall.json'
import shoes from './catalog/shoes.json'
import gloves from './catalog/gloves.json'
import cape from './catalog/cape.json'
import shield from './catalog/shield.json'
import pendant from './catalog/pendant.json'
import medal from './catalog/medal.json'
import belt from './catalog/belt.json'
import petAcc from './catalog/petAcc.json'
import weapon from './catalog/weapon.json'

const CATALOG_FILES = [
  hat,
  faceAccessory,
  eyeAccessory,
  earring,
  top,
  bottom,
  overall,
  shoes,
  gloves,
  cape,
  shield,
  pendant,
  medal,
  belt,
  petAcc,
  weapon,
] as unknown as ItemData[][]

/** 전체 카탈로그(평탄화) */
export const CATALOG_ITEMS: ItemData[] = CATALOG_FILES.flat()

/** id → ItemData 인덱스 */
const CATALOG_BY_ID: ReadonlyMap<number, ItemData> = new Map(
  CATALOG_ITEMS.map((it) => [it.id, it]),
)

/** 카탈로그에서 단건 조회(없으면 undefined) */
export function getCatalogItem(id: number): ItemData | undefined {
  return CATALOG_BY_ID.get(id)
}

/** 특정 부위의 카탈로그 아이템 목록(UI 리스트용) */
export function listCatalogBySlot(slot: SlotId): ItemData[] {
  return CATALOG_ITEMS.filter((it) => it.slot === slot)
}
