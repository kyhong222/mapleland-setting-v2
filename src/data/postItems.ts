/**
 * 사후패치(메이플랜드 자체 패치) 아이템 오버라이드.
 *
 * 부분 병합(partial merge) 방식: 카탈로그/ API로 해석한 기본 ItemData 위에
 * 여기서 지정한 필드만 덮어쓴다(얕은 병합). 한 필드(예: tuc)만 교정하기 좋다.
 *  - 예) { id: 1092050, tuc: 0 }  → 칸자르의 업횟만 0으로 교정, 나머지는 그대로
 *  - effects를 지정하면 effects 객체 전체가 교체된다(부분 효과 교정은 전체 effects 명시).
 *
 * 카탈로그에 없는 아이템을 여기에만 둘 경우, 표시에 필요한 필드(name/slot 등)를 모두 포함해야 한다.
 */

import type { ItemData } from '../domain/item'

export type PostItemOverride = Partial<ItemData> & { id: number }

const POST_ITEM_OVERRIDES: PostItemOverride[] = [
  { id: 1092050, tuc: 0 }, // 칸자르 (도적 방패) — 메이플랜드 업횟 0
  { id: 1122059, tuc: 0 }, // 나리케인의 징표 (펜던트) — 업횟 0
  // 황혼의 레이븐즈 클로 — 메랜 실제 스펙 (공38/HP100/행운2/물방5/공속5)
  { id: 1472074, effects: { pad: 38, hp: 100, LUK: 2, pdef: 5, attackSpeed: 4 } },
]

export const POST_ITEMS: ReadonlyMap<number, PostItemOverride> = new Map(
  POST_ITEM_OVERRIDES.map((o) => [o.id, o]),
)

/** 사후패치 오버라이드 조회(없으면 undefined) */
export function getPostItem(id: number): PostItemOverride | undefined {
  return POST_ITEMS.get(id)
}
