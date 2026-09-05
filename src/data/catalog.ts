/**
 * 로컬 아이템 카탈로그.
 *
 * v1(kyhong222/mapleland-setting)의 pre/post 데이터를 v2 ItemData로 변환한 번들 데이터.
 * (생성: `node scripts/convertV1.mjs` → src/data/catalog/<slot>.json)
 *
 * itemRepository가 API보다 먼저 이 카탈로그를 조회한다(로컬 우선 → API 폴백).
 * 재생성하려면 변환 스크립트를 다시 실행하면 된다.
 *
 * ── iconUrl은 항목 id와 무관할 수 있다 ──
 * 메이플랜드는 원작 아이콘을 임의로 재사용한다. 퀘스트 훈장 2종이 그 예로, 원작
 * 아이콘이 서로 엇갈려 붙어 있다.
 *   1142002 퀘스트 스페셜리스트의 훈장 → 원작 1142001 아이콘
 *   9142002 퀘스트 매니아의 훈장       → 원작 1142002 아이콘
 * iconUrl을 id에서 유도하지 말고 항상 명시 필드를 쓸 것.
 *
 * ── 합성 id (9xxxxxx) ──
 * 원작에 없는 메이플랜드 오리지널 아이템은 WZ id가 없어 우리가 id를 부여한다.
 * 규약: `9` + 아이콘을 빌려온 원작 아이템 id의 뒤 6자리.
 * 예) 퀘스트 매니아의 훈장은 원작 1142002 아이콘을 쓰므로 9142002.
 * 실제 아이템 id는 1~5로 시작하므로 9로 시작하면 무엇과도 충돌하지 않는다.
 * slot은 id가 아니라 명시 필드로 정해지므로 id 형태가 동작에 영향을 주지 않고,
 * scripts/refreshReq.mjs는 API 404 시 기존값을 유지하므로 합성 id를 건너뛴다.
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
import ring from './catalog/ring.json'
import medal from './catalog/medal.json'
import belt from './catalog/belt.json'
import petAcc from './catalog/petAcc.json'
import weapon from './catalog/weapon.json'
import arrow from './catalog/arrow.json'
import bolt from './catalog/bolt.json'
import throwingStar from './catalog/throwingStar.json'
import bullet from './catalog/bullet.json'

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
  ring,
  medal,
  belt,
  petAcc,
  weapon,
  arrow,
  bolt,
  throwingStar,
  bullet,
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
