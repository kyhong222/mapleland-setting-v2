/**
 * 도핑 목록 편집용 버프 카테고리 — 버프가 올려 주는 능력치로 묶는다.
 *
 * 효과가 여러 개면 해당 카테고리 전부에 속한다(혼버프 = 공격력·마력·방어력·마법방어력).
 * **양수인 효과만 본다** — 사이다(명중 −5)·분노(방어 −12)의 감소분으로 그 카테고리에 들어가지 않게.
 * 어느 카테고리에도 안 맞는 효과가 하나라도 있으면 '기타'에도 넣는다(샤프 아이즈·위협·하이퍼 바디 등).
 */

import type { EffectId, EffectMap } from './effects'

export type BuffCategoryId =
  | 'pad' | 'mad' | 'pdef' | 'mdef' | 'speed' | 'jump' | 'eva' | 'acc'
  | 'addPad' | 'addMad' | 'attackSpeed' | 'etc'

/** 표시 순서 · 라벨 · 해당 효과 id */
export const BUFF_CATEGORIES: { id: BuffCategoryId; label: string; effects: EffectId[] }[] = [
  { id: 'pad', label: '공격력', effects: ['pad'] },
  { id: 'mad', label: '마력', effects: ['mad'] },
  { id: 'pdef', label: '방어력', effects: ['pdef'] },
  { id: 'mdef', label: '마법방어력', effects: ['mdef'] },
  { id: 'speed', label: '이동속도', effects: ['speed'] },
  { id: 'jump', label: '점프력', effects: ['jump'] },
  { id: 'eva', label: '회피율', effects: ['eva'] },
  { id: 'acc', label: '명중률', effects: ['acc'] },
  { id: 'addPad', label: '추가공격력', effects: ['addPad'] },
  { id: 'addMad', label: '추가마력', effects: ['addMad'] },
  { id: 'attackSpeed', label: '공격속도(시전속도)', effects: ['attackSpeedBoost', 'castSpeedBoost', 'windBoostStep'] },
  { id: 'etc', label: '기타', effects: [] },
]

const CATEGORY_OF = new Map<EffectId, BuffCategoryId>(
  BUFF_CATEGORIES.flatMap((c) => c.effects.map((e) => [e, c.id] as const)),
)

/** 효과 맵이 속하는 카테고리 (표시 순서대로). 효과가 없으면 ['etc'] */
export function buffCategoriesOf(eff: EffectMap): BuffCategoryId[] {
  const out = new Set<BuffCategoryId>()
  for (const [id, v] of Object.entries(eff) as [EffectId, number][]) {
    if (!(v > 0)) continue
    out.add(CATEGORY_OF.get(id) ?? 'etc')
  }
  if (out.size === 0) out.add('etc')
  return BUFF_CATEGORIES.map((c) => c.id).filter((id) => out.has(id))
}
