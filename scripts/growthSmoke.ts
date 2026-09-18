/**
 * 성장(레벨업) 스펙 확인.
 *  - 아이템 단위 기믹(월묘 견장): 스탯별 개별 레벨업이 0~5 범위로 잡히는지 + 클램프
 *  - 이름 접두사 기믹(리버스/타임리스): 기존 경로가 그대로인지
 */

import { CATALOG_ITEMS, getCatalogItem } from '../src/data/catalog'
import { itemGrowthSpec, clampGrowth } from '../src/domain/growth'
import { emptyBuiltItem, resolveBuiltItem } from '../src/domain/builtItem'
import type { EffectMap } from '../src/domain/effects'

// ── 아이템 단위: 월묘 견장 (STR/DEX/INT/LUK 각각 0~5, 총합 제한 없음) ──
const shoulder = getCatalogItem(1152052)
if (!shoulder) throw new Error('월묘 견장(1152052)이 카탈로그에 없다')
const spec = itemGrowthSpec(shoulder)
if (!spec) throw new Error('월묘 견장에 성장 스펙이 없다')
if (!spec.perStatLevels) throw new Error('월묘 견장은 스탯별 개별 레벨업이어야 한다')

console.log(`${shoulder.name} · ${spec.tier} · 스탯별 최대 ${spec.maxLevel}레벨`)
for (const st of spec.stats) {
  if (st.totalMin !== 0 || st.totalMax !== 5) {
    throw new Error(`${st.effectId} 누적 범위가 0~5가 아니다: ${st.totalMin}~${st.totalMax}`)
  }
  console.log(`  ${st.effectId} 레벨당 +${st.perLevelMin} · 누적 ${st.totalMin}~${st.totalMax}`)
}

const cases: [string, EffectMap][] = [
  ['성장 없음', {}],
  ['STR만 만렙', { STR: 5 }],
  ['제각각', { STR: 3, DEX: 1, INT: 0, LUK: 5 }],
  ['전부 만렙', { STR: 5, DEX: 5, INT: 5, LUK: 5 }],
  ['범위 초과(클램프)', { STR: 9, DEX: -2 }],
]
for (const [label, raw] of cases) {
  const growth = clampGrowth(spec, raw)
  const final = resolveBuiltItem({ ...emptyBuiltItem(shoulder), growth }).finalEffects
  console.log(`  ${label}: 성장 ${JSON.stringify(growth)} → 최종 ${JSON.stringify(final)}`)
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
console.log(`\n리버스/타임리스 성장 아이템 ${ranged.length}건 — 전부 아이템 단위 레벨업`)
for (const [item, s] of ranged.slice(0, 3)) {
  console.log(`  ${item.name} · ${s.tier} · 최대 ${s.maxLevel}레벨 · ${s.stats.map((st) => `${st.effectId} 0~${st.totalMax}`).join(', ')}`)
}
