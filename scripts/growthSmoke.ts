/**
 * 성장(레벨업) 스펙 확인.
 *  - 아이템 단위 고정 성장(월묘 견장): 레벨 → 누적치 → 레벨 역산이 왕복하는지
 *  - 이름 접두사 가변 성장(리버스/타임리스): 기존 경로가 그대로인지
 */

import { CATALOG_ITEMS, getCatalogItem } from '../src/data/catalog'
import { itemGrowthSpec, growthAtLevel, growthLevelOf } from '../src/domain/growth'
import { emptyBuiltItem, resolveBuiltItem } from '../src/domain/builtItem'

// ── 고정 성장: 월묘 견장 (레벨업당 올스탯 +1, 5레벨) ──
const shoulder = getCatalogItem(1152052)
if (!shoulder) throw new Error('월묘 견장(1152052)이 카탈로그에 없다')
const spec = itemGrowthSpec(shoulder)
if (!spec) throw new Error('월묘 견장에 성장 스펙이 없다')
if (!spec.fixed) throw new Error('월묘 견장은 고정 성장이어야 한다')

console.log(`${shoulder.name} · ${spec.tier} · 최대 ${spec.maxLevel}레벨 · 고정=${spec.fixed}`)
for (let lv = 0; lv <= spec.maxLevel; lv++) {
  const growth = growthAtLevel(spec, lv)
  const back = growthLevelOf(spec, growth)
  if (back !== lv) throw new Error(`레벨 역산 불일치: ${lv} → ${back}`)
  const final = resolveBuiltItem({ ...emptyBuiltItem(shoulder), growth }).finalEffects
  console.log(`  lv${lv} → 최종 ${JSON.stringify(final)}`)
}
// 범위 밖 입력은 클램프
if (growthLevelOf(spec, growthAtLevel(spec, 99)) !== spec.maxLevel) throw new Error('상한 클램프 실패')

// ── 가변 성장: 이름 접두사 경로 ──
const ranged = CATALOG_ITEMS.filter((i) => /^(타임리스|리버스)\s/.test(i.name))
  .map((i) => [i, itemGrowthSpec(i)] as const)
  .filter(([, s]) => s !== null)
if (ranged.length === 0) throw new Error('리버스/타임리스 성장 아이템을 찾지 못했다')
const fixedByName = ranged.filter(([, s]) => s!.fixed)
if (fixedByName.length > 0) {
  throw new Error(`리버스/타임리스는 가변이어야 한다: ${fixedByName.map(([i]) => i.name).join(', ')}`)
}
console.log(`\n리버스/타임리스 성장 아이템 ${ranged.length}건 — 전부 가변(fixed=false)`)
for (const [item, s] of ranged.slice(0, 3)) {
  console.log(`  ${item.name} · ${s!.tier} · ${s!.stats.map((st) => `${st.effectId} 0~${st.totalMax}`).join(', ')}`)
}
