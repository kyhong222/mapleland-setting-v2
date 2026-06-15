/**
 * maplestory.io 저수준 클라이언트.
 *
 * - 없는 아이템은 /item/{id}가 HTTP 200 + 본문 `null`을 반환하므로 본문 null로 판정한다.
 * - /name은 없는 경우 { error, ... } 객체를 반환하므로 error 필드로 판정한다.
 */

import {
  MSIO_BASE,
  ITEM_REGION,
  NAME_REGION,
  NAME_VERSION,
} from './config'
import type { MsioItemSpec, MsioItemName } from './msioTypes'

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url)
  if (!res.ok) return null
  return (await res.json()) as unknown
}

/** 특정 버전에서 아이템 스펙을 가져온다. 없으면 null. */
export async function fetchItemSpec(
  version: string,
  id: number,
): Promise<MsioItemSpec | null> {
  const data = await getJson(`${MSIO_BASE}/${ITEM_REGION}/${version}/item/${id}`)
  if (!data || typeof data !== 'object') return null
  return data as MsioItemSpec
}

/** KMS 300에서 한글명을 가져온다. 없거나 오류면 null. */
export async function fetchKoreanName(id: number): Promise<string | null> {
  const data = await getJson(
    `${MSIO_BASE}/${NAME_REGION}/${NAME_VERSION}/item/${id}/name`,
  )
  if (!data || typeof data !== 'object') return null
  if ('error' in data) return null
  const name = (data as MsioItemName).name
  return typeof name === 'string' && name.length > 0 ? name : null
}

/** 아이콘 이미지 URL (별도 호출 없이 URL만 생성) */
export function itemIconUrl(version: string, id: number): string {
  return `${MSIO_BASE}/${ITEM_REGION}/${version}/item/${id}/icon`
}
