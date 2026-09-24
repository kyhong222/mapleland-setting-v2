/**
 * 바이퍼 스턴 변형 스모크.
 *
 *   npx tsx scripts/viperStunSmoke.ts
 *
 * 기대값: OK만 출력. FAIL이 하나라도 있으면 변형 스킬/스턴 마스터리 배선이 깨진 것.
 *
 * 확인하는 것:
 *  §1 변형 id가 실제 스킬 id와 겹치지 않는다 (겹치면 아이콘·모션·공속이 엉뚱한 스킬로 조회된다)
 *  §2 바이퍼 공격 스킬마다 '(스턴)'이 한 벌씩 붙는다
 *  §3 스턴 비율 — 기본 0 / (스턴) 1 / 자체 스턴 확률을 가진 스킬(에너지 버스터)은 기본에 prop 반영
 *  §4 스턴 마스터리는 상시 합산에서 빠지고 조건부 합산에만 잡힌다
 *  §5 자체 스턴 확률 스킬이 쓰는 혼합 분포가 가중평균과 맞는다
 */

import { attackSkillsForJob, skillsForJob } from '../src/data/skills'
import { JOB_SKILLBOOKS } from '../src/data/skills'
import {
  baseSkillId, damageSkillsForJob, migrateSkillId, stunHitRatio, variantKindOf, variantSkillId,
} from '../src/data/skills/variants'
import { computeCast, mixCasts } from '../src/domain/skillCombat'
import { expectedValue } from '../src/domain/nhitProb'
import { activeBuffEffects, conditionalBuffEffects } from '../src/store/aggregate'
import type { BuffContext } from '../src/store/aggregate'
import type { JobId } from '../src/domain/jobs'

let fails = 0

function expect(label: string, actual: unknown, want: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(want)
  if (!ok) fails++
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label} → ${JSON.stringify(actual)}${ok ? '' : ` (기대 ${JSON.stringify(want)})`}`)
}

const JOB_IDS = Object.keys(JOB_SKILLBOOKS) as JobId[]

// ── §1 id 충돌 ────────────────────────────────────────────────────
console.log('── 변형 id ──')
const realIds = [...new Set(JOB_IDS.flatMap((j) => skillsForJob(j).map((s) => s.id)))]
expect('변형으로 오인되는 실제 스킬 id', realIds.filter((id) => variantKindOf(id) !== null), [])
expect('변형 id 왕복 (피스트)', baseSkillId(variantSkillId(5121007, 'stun')), 5121007)
expect('변형 id 왕복 (에너지 버스터)', baseSkillId(variantSkillId(5111002, 'stun')), 5111002)
expect('변형 종류 판정', [
  variantKindOf(5121007),
  variantKindOf(variantSkillId(5121007, 'stun')),
], [null, 'stun'])
// 없앤 '(단독 운용)' 변형은 기본 항목으로 되돌린다 (저장된 선택 보정)
expect('없앤 변형 id 보정', [migrateSkillId(805111002), migrateSkillId(5121007)], [5111002, 5121007])

// ── §2 목록 구성 ──────────────────────────────────────────────────
console.log('\n── 스킬 목록 ──')
const viperBase = attackSkillsForJob('viper')
const viperAll = damageSkillsForJob('viper')
expect('바이퍼 항목 수 (기본 + 스턴)', viperAll.length, viperBase.length * 2)
const nameOf = (id: number) => viperAll.find((s) => s.id === id)?.description?.name
expect('피스트 (스턴) 이름', nameOf(variantSkillId(5121007, 'stun')), '피스트 (스턴)')
expect('에너지 버스터 (스턴) 이름', nameOf(variantSkillId(5111002, 'stun')), '에너지 버스터 (스턴)')
// 스턴 마스터리가 없는 직업은 변형 없이 그대로
expect(
  '스턴 마스터리 없는 직업에 변형이 붙는지',
  JOB_IDS.filter((j) => j !== 'viper' && damageSkillsForJob(j).length !== attackSkillsForJob(j).length),
  [],
)

// ── §3 스턴 비율 ──────────────────────────────────────────────────
console.log('\n── 스턴 비율 ──')
expect('피스트 기본', stunHitRatio(5121007, 30), 0)
expect('피스트 (스턴)', stunHitRatio(variantSkillId(5121007, 'stun'), 30), 1)
// 에너지 버스터는 자체 스턴 확률이 있어 기본 항목에 반영된다 — lv1 11% → lv30 40%
// (인게임 값, 상류 스킬북에 없어 보강)
expect('에너지 버스터 기본 lv30', stunHitRatio(5111002, 30), 0.4)
expect('에너지 버스터 기본 lv1', stunHitRatio(5111002, 1), 0.11)
expect('에너지 버스터 (스턴)', stunHitRatio(variantSkillId(5111002, 'stun'), 30), 1)

// ── §4 조건부 버프 배선 ───────────────────────────────────────────
console.log('\n── 스턴 마스터리 합산 ──')
const ctx: BuffContext = {
  activeBuffs: { '5110000': 20 },
  appliedBuffs: {},
  masteryLevels: {},
  jobId: 'viper',
}
const always = activeBuffEffects(ctx)
const onStun = conditionalBuffEffects(ctx, 'stun')
expect('상시 합산에 크리 확률', always.criticalP ?? 0, 0)
expect('상시 합산에 크리 추뎀', always.criticalDamage ?? 0, 0)
// 스킬북 lv20: prop 60 → 크리 확률 60%, damage 160 → 추뎀 **+160%**.
// 크리티컬 샷/스로우/펀치와 달리 -100을 빼지 않는다 (실측, docs/plan.md §크리티컬)
expect('조건부 합산 크리 확률', onStun.criticalP, 60)
expect('조건부 합산 크리 추뎀', onStun.criticalDamage, 160)

// ── §5 단독 운용 혼합 분포 ────────────────────────────────────────
console.log('\n── 혼합 분포 ──')
/** 피스트 1회 시전 (스턴 크리 유무만 다르게) */
const fistCast = (critP: number, critD: number) =>
  computeCast({
    weaponType: 'knuckle', skillId: 5121007, attackCount: 6, kind: 'physical',
    primary: 1000, secondary: 200, watk: 300, mastery: 0.6,
    elementMult: 1, defense: { kind: 'physical', def: 300, levelPenalty: 0 },
    skillPercent: 126, damageMult: 1, critProb: critP, critMult: critD,
    hitMultipliers: [1, 1, 1, 1, 2, 4],
  })
const plain = fistCast(0, 1)
const stunned = fistCast(0.6, (126 + 160) / 126)
if (!plain || !stunned) {
  fails++
  console.log('FAIL 피스트 시전 분포를 만들지 못했다')
} else {
  const mixed = mixCasts([{ weight: 0.6, cast: plain }, { weight: 0.4, cast: stunned }])
  const want = 0.6 * expectedValue(plain.dist) + 0.4 * expectedValue(stunned.dist)
  const got = expectedValue(mixed.dist)
  const ok = Math.abs(got - want) / want < 0.002
  if (!ok) fails++
  console.log(`${ok ? 'OK  ' : 'FAIL'} 혼합 기대 데미지 ${Math.round(got)} (가중평균 ${Math.round(want)})`)
  expect('스턴 쪽이 더 세다', expectedValue(stunned.dist) > expectedValue(plain.dist), true)
  expect('혼합 범위는 양쪽을 덮는다', [
    mixed.totalRange.min <= Math.min(plain.totalRange.min, stunned.totalRange.min),
    mixed.totalRange.max >= Math.max(plain.totalRange.max, stunned.totalRange.max),
  ], [true, true])
}

console.log(fails ? `\n${fails}건 실패` : '\n전부 통과')
process.exit(fails ? 1 : 0)
