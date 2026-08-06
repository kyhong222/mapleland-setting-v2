/**
 * BuiltItem — 메이커로 제작한 아이템(레시피).
 *
 * 베이스(카탈로그/postItem 스냅샷) + 수치조정 + 주문서 + 보석을 담고,
 * 최종 효과/정옵 대비 delta/등급은 resolveBuiltItem으로 파생한다.
 *
 * 순수 도메인 유지를 위해 주문서 효과는 적용 시점에 스냅샷(AppliedScroll.effects)으로 저장한다.
 */

import type { ItemData } from './item'
import type { EffectMap } from './effects'
import { sumEffects } from './effects'
import type { ScrollRate } from './scrolls'
import type { GemSelection } from './maker'
import { applyGems } from './maker'
import type { GradeResult } from './grade'
import { computeGrade } from './grade'

export interface AppliedScroll {
  /** 주문서 군 key (ScrollDef.key) */
  key: string
  rate: ScrollRate
  /** 적용 시점에 스냅샷한 부여 효과 */
  effects: EffectMap
}

export interface BuiltItem {
  base: ItemData
  /** 수치조정(정옵 대비 수동 가감) */
  adjustments?: EffectMap
  /** 적용 주문서 (base.tuc 이내) */
  scrolls: AppliedScroll[]
  /** 적용 보석 (슬롯 용량 이내) */
  gems: GemSelection[]
  /** 리버스/타임리스 레벨업 성장치(누적). 정옵/등급과 무관하게 최종 효과에만 가산. */
  growth?: EffectMap
}

export interface BuiltItemResult {
  /** 정옵 대비 가감분 (수치조정 + 주문서 + 보석) */
  delta: EffectMap
  /** base.effects + delta + growth */
  finalEffects: EffectMap
  /** delta + 성장치 + 주문서 사용 여부로 산출한 등급 */
  grade: GradeResult
}

/** 정옵 대비 delta */
export function builtItemDelta(b: BuiltItem): EffectMap {
  return sumEffects(
    b.adjustments ?? {},
    ...b.scrolls.map((s) => s.effects),
    applyGems(b.gems),
  )
}

export function resolveBuiltItem(b: BuiltItem): BuiltItemResult {
  const delta = builtItemDelta(b)
  const growth = b.growth ?? {}
  const finalEffects = sumEffects(b.base.effects, delta, growth)
  // 성장치(리버스/타임리스 레벨업)도 정옵 대비 향상분이므로 등급 점수에 포함한다.
  const grade = computeGrade(sumEffects(delta, growth), b.scrolls.length > 0)
  return { delta, finalEffects, grade }
}

/** 베이스만 가진 빈 BuiltItem */
export function emptyBuiltItem(base: ItemData): BuiltItem {
  return { base, scrolls: [], gems: [] }
}
