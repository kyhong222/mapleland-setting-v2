/**
 * 주문서(scroll) 도메인 모델.
 *
 * 확률 시뮬레이션은 하지 않는다. 100/60/10 표준 주문서의 등급별 부여 효과를
 * 옵션으로 제공해 아이템 제작(세팅 구성)을 돕는다.
 *
 * - 방어구/장신구 주문서: slot 단위 적용
 * - 무기 주문서: weaponType 단위 적용 (한손검/두손검/.../건)
 * - 특정 아이템 전용/커스텀 주문서: itemIds로 한정 (확장용)
 */

import type { EffectMap } from './effects'
import { sumEffects } from './effects'
import type { SlotId } from './equipSlots'
import type { WeaponType } from './weapons'

/** 표준 주문서 성공률 등급 */
export type ScrollRate = 100 | 60 | 10

export interface ScrollOption {
  rate: ScrollRate
  /** 해당 등급에서 부여하는 효과(다중 가능) */
  effects: EffectMap
  /** 원본 게임 아이템 id (아이콘/식별용). 커스텀 주문서는 없을 수 있음 */
  itemId?: number
}

export interface ScrollDef {
  /** 식별 키 (예: 'hat:투구 방어력 주문서') */
  key: string
  /** 표시명 (예: '투구 방어력 주문서') */
  name: string
  /** 적용 부위(방어구/장신구 주문서) */
  slot?: SlotId
  /** 적용 무기 종류(무기 주문서) */
  weaponType?: WeaponType
  /** 특정 아이템 전용(예: 드래곤의 돌 → 혼테일의 목걸이). 커스텀 확장용 */
  itemIds?: number[]
  /** 등급별 옵션 (rate 내림차순: 100, 60, 10 중 존재하는 것) */
  options: ScrollOption[]
}

/** 선택한 주문서 옵션들의 효과 합 */
export function scrollEffects(options: ScrollOption[]): EffectMap {
  return sumEffects(...options.map((o) => o.effects))
}
