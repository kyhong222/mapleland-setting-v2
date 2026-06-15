/**
 * 아이템 모델.
 *
 * effects에는 ITEM_EFFECTS 부분집합만 사용한다. weaponType은 slot === 'weapon'일 때만 의미를 가진다.
 * id 체계는 maplestory.io 아이템 id를 따르며 로컬 JSON도 동일 체계를 사용한다.
 */

import type { EffectId, EffectMap } from './effects'
import { ITEM_EFFECT_IDS } from './effects'
import type { SlotId } from './equipSlots'
import type { WeaponType } from './weapons'

export interface ItemData {
  /** maplestory.io 아이템 id (로컬 동일 체계) */
  id: number
  name: string
  slot: SlotId
  /** ITEM_EFFECTS 부분집합만 허용 */
  effects: EffectMap
  /** 착용 요구 레벨 */
  reqLevel?: number
  /** 업그레이드 가능 횟수(tuc) — 주문서를 바를 수 있는 횟수. postItem으로 덮어쓸 수 있음 */
  tuc?: number
  /**
   * 착용 직업 제한 비트마스크(메이플 표준). 0/미지정 = 공용.
   * 1=전사, 2=마법사, 4=궁수, 8=도적, 16=해적 (조합 가능)
   */
  reqJob?: number
  /** slot === 'weapon'일 때만 의미 있음 */
  weaponType?: WeaponType
  /** maplestory.io 아이콘 URL */
  iconUrl?: string
}

/**
 * 임의의 EffectMap에서 아이템에 붙을 수 있는 효과만 남긴다.
 * (API/로컬 데이터 정규화 시 비-아이템 효과를 걸러내는 용도)
 */
export function pickItemEffects(effects: EffectMap): EffectMap {
  const result: EffectMap = {}
  for (const key of Object.keys(effects) as EffectId[]) {
    if (ITEM_EFFECT_IDS.has(key)) {
      const v = effects[key]
      if (v !== undefined) result[key] = v
    }
  }
  return result
}
