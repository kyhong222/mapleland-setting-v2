/**
 * 아이템 레포지토리 — 컴포넌트가 사용하는 단일 진입점.
 *
 * getItem(id) 흐름:
 *   1) 기본 ItemData 해석: 로컬 카탈로그(v1 변환) → 없으면 maplestory.io(GMS 62→200) + KMS 300 한글명 정규화
 *   2) 사후패치 오버라이드(postItem, 부분 병합)가 있으면 기본 위에 지정 필드를 덮어씀
 *
 * 동일 id에 대한 메모리 캐시 및 in-flight 중복요청 합치기를 제공한다.
 */

import type { ItemData } from '../domain/item'
import { ITEM_VERSION_PRIMARY, ITEM_VERSION_FALLBACK } from './config'
import { fetchItemSpec, fetchKoreanName } from './msioClient'
import { normalizeItem } from './normalize'
import { getPostItem } from './postItems'
import { getCatalogItem } from './catalog'

const cache = new Map<number, ItemData | null>()
const inflight = new Map<number, Promise<ItemData | null>>()

async function resolveBase(id: number): Promise<ItemData | null> {
  // 로컬 카탈로그 우선
  const catalog = getCatalogItem(id)
  if (catalog) return catalog

  // API: GMS 62 → GMS 200 폴백
  let version = ITEM_VERSION_PRIMARY
  let spec = await fetchItemSpec(version, id)
  if (!spec) {
    version = ITEM_VERSION_FALLBACK
    spec = await fetchItemSpec(version, id)
  }
  if (!spec) return null

  // 한글명(KMS 300) + 정규화
  const koreanName = await fetchKoreanName(id)
  return normalizeItem(spec, { version, koreanName })
}

async function loadItem(id: number): Promise<ItemData | null> {
  const base = await resolveBase(id)
  const override = getPostItem(id)
  if (!override) return base
  // 부분 병합: 기본 위에 지정 필드만 덮어씀. 기본이 없으면 오버라이드를 단독 사용.
  return base ? { ...base, ...override } : (override as ItemData)
}

/**
 * 아이템 단건 조회. 미존재/비장비면 null.
 * 결과(및 null)는 캐시되며, 진행 중 동일요청은 합쳐진다.
 */
export function getItem(id: number): Promise<ItemData | null> {
  const cached = cache.get(id)
  if (cached !== undefined) return Promise.resolve(cached)

  const existing = inflight.get(id)
  if (existing) return existing

  const p = loadItem(id)
    .then((item) => {
      cache.set(id, item)
      inflight.delete(id)
      return item
    })
    .catch((err) => {
      inflight.delete(id)
      throw err
    })

  inflight.set(id, p)
  return p
}

/** 여러 아이템 병렬 조회 (실패/미존재는 제외) */
export async function getItems(ids: number[]): Promise<ItemData[]> {
  const results = await Promise.all(ids.map((id) => getItem(id)))
  return results.filter((it): it is ItemData => it !== null)
}

/** 캐시 비우기(테스트/강제 갱신용) */
export function clearItemCache(): void {
  cache.clear()
}
