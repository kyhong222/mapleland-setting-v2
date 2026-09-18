/**
 * 성장(레벨업) 스펙 확인.
 *  - 아이템 단위 기믹(월묘 견장·황금 송편 목걸이): 스탯별 개별 레벨업 범위 + 클램프
 *  - 이름 접두사 기믹(리버스/타임리스): 기존 경로가 그대로인지
 */

import { CATALOG_ITEMS, getCatalogItem } from '../src/data/catalog'
import { itemGrowthSpec, clampGrowth } from '../src/domain/growth'
import { emptyBuiltItem, resolveBuiltItem } from '../src/domain/builtItem'
import type { EffectMap } from '../src/domain/effects'

/** 스탯별 개별 레벨업 아이템: [id, 기대 만렙 올스탯] */
const PER_STAT_ITEMS: [number, number][] = [
  [1152052, 10], // 월묘 견장 — 정옵 올스탯 5 + 스탯별 5업
  [1122161, 15], // 황금 송편 목걸이 — 정옵 올스탯 10 + 스탯별 5업
]

for (const [id, maxAllStat] of PER_STAT_ITEMS) {
  const item = getCatalogItem(id)
  if (!item) throw new Error(`${id}이 카탈로그에 없다`)
  const spec = itemGrowthSpec(item)
  if (!spec) throw new Error(`${item.name}에 성장 스펙이 없다`)
  if (!spec.perStatLevels) throw new Error(`${item.name}은 스탯별 개별 레벨업이어야 한다`)

  console.log(`${item.name}(${id}) · ${spec.tier} · 스탯별 최대 ${spec.maxLevel}레벨`)
  for (const st of spec.stats) {
    if (st.totalMin !== 0 || st.totalMax !== spec.maxLevel) {
      throw new Error(`${st.effectId} 누적 범위가 0~${spec.maxLevel}이 아니다: ${st.totalMin}~${st.totalMax}`)
    }
  }
  console.log(`  ${spec.stats.map((st) => `${st.effectId} 레벨당 +${st.perLevelMax} · 누적 0~${st.totalMax}`).join(' | ')}`)

  const cases: [string, EffectMap][] = [
    ['성장 없음', {}],
    ['STR만 만렙', { STR: 5 }],
    ['제각각', { STR: 3, DEX: 1, INT: 0, LUK: 5 }],
    ['전부 만렙', { STR: 5, DEX: 5, INT: 5, LUK: 5 }],
    ['범위 초과(클램프)', { STR: 9, DEX: -2 }],
  ]
  for (const [label, raw] of cases) {
    const growth = clampGrowth(spec, raw)
    const final = resolveBuiltItem({ ...emptyBuiltItem(item), growth }).finalEffects
    console.log(`  ${label}: 성장 ${JSON.stringify(growth)} → 최종 ${JSON.stringify(final)}`)
  }

  const capped = resolveBuiltItem({
    ...emptyBuiltItem(item),
    growth: clampGrowth(spec, { STR: 99, DEX: 99, INT: 99, LUK: 99 }),
  }).finalEffects
  for (const s of ['STR', 'DEX', 'INT', 'LUK'] as const) {
    if (capped[s] !== maxAllStat) throw new Error(`${item.name} 만렙 ${s}가 ${maxAllStat}이 아니다: ${capped[s]}`)
  }
  console.log(`  → 만렙 올스탯 ${maxAllStat} 확인\n`)
}

// ── 이름 접두사 경로가 그대로인지 ──
const ranged = CATALOG_ITEMS.filter((i) => /^(타임리스|리버스)\s/.test(i.name))
  .map((i) => [i, itemGrowthSpec(i)] as const)
  .filter((e): e is readonly [(typeof CATALOG_ITEMS)[number], NonNullable<ReturnType<typeof itemGrowthSpec>>] => e[1] !== null)
if (ranged.length === 0) throw new Error('리버스/타임리스 성장 아이템을 찾지 못했다')
const mislabeled = ranged.filter(([, s]) => s.perStatLevels)
if (mislabeled.length > 0) {
  throw new Error(`리버스/타임리스는 아이템 단위 레벨업이어야 한다: ${mislabeled.map(([i]) => i.name).join(', ')}`)
}
console.log(`리버스/타임리스 성장 아이템 ${ranged.length}건 — 전부 아이템 단위 레벨업`)
for (const [item, s] of ranged.slice(0, 3)) {
  console.log(`  ${item.name} · ${s.tier} · 최대 ${s.maxLevel}레벨 · ${s.stats.map((st) => `${st.effectId} 0~${st.totalMax}`).join(', ')}`)
}
