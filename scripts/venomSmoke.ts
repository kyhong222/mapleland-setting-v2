/**
 * 수동 스모크 테스트: 베놈 (tsx) — docs/nhit-dpm.md §4 베놈
 *  - 공식 손계산 대조
 *  - 방어·렙차 적용, 독 반응(약점 ×1 / 반감·무효 ×0)
 *  - 1~3중첩: 데미지 N배, 변형 id 왕복, 표시 이름
 *  - 추가스킬로 넣었을 때 틱만으로는 처치되지 않음 (HP 1 상한)
 *  - DPM 미산출
 */
import {
  baseSkillId, damageSkillsForJob, variantKindOf, variantSkillId, venomStacks, VENOM_SKILLS,
} from '../src/data/skills/variants'
import { skillAttackAt } from '../src/data/skills'
import { attacksPerMinute } from '../src/data/attackSpeed'
import type { SpeedContext } from '../src/data/attackSpeed'
import { calcVenom } from '../src/domain/attackPower'
import { computeDotCast, computeNhit } from '../src/domain/skillCombat'
import { capDist, expectedValue, uniformDist } from '../src/domain/nhitProb'
import type { JobId } from '../src/domain/jobs'

let fail = 0
const check = (ok: boolean, msg: string) => {
  if (!ok) fail++
  console.log(ok ? '  ✓' : '  ✗', msg)
}

console.log('공식')
// STR 4 + LUK 996 = 1000, DEX 50: MAX (18500+100)/100×60 = 11160, MIN (8000+100)/100×60 = 4860
const tick = calcVenom(4, 996, 50, 60)
check(tick.max === 11160 && tick.min === 4860, `MAX 11160 / MIN 4860 (${tick.max} / ${tick.min})`)

console.log('방어·렙차')
const noDef = computeDotCast(tick, 'none', undefined)
check(noDef.totalRange.max === 11160 && noDef.totalRange.min === 4860, '방어 없음: 공식 값 그대로')
// 방어 100, 렙차 0: MIN 4860 − 100×0.6 = 4800, MAX 11160 − 100×0.5 = 11110
const def0 = computeDotCast(tick, 'none', { kind: 'physical', def: 100, levelPenalty: 0 })
check(def0.totalRange.min === 4800 && def0.totalRange.max === 11110, `방어 100 (${def0.totalRange.min}~${def0.totalRange.max})`)
// 방어 100, 렙차 5: MIN 4860×0.95 − 60 = 4557, MAX 11160×0.95 − 50 = 10552
const def5 = computeDotCast(tick, 'none', { kind: 'physical', def: 100, levelPenalty: 5 })
check(def5.totalRange.min === 4557 && def5.totalRange.max === 10552, `방어 100·렙차 5 (${def5.totalRange.min}~${def5.totalRange.max})`)

console.log('독 반응')
const weak = computeDotCast(tick, 'weak', undefined)
check(weak.totalRange.max === 11160 && weak.totalRange.min === 4860, '약점: 추가피해 없음')
for (const r of ['half', 'immune'] as const) {
  const c = computeDotCast(tick, r, { kind: 'physical', def: 100, levelPenalty: 5 }, 3)
  check(c.totalRange.max === 0 && c.dist.p.length === 1 && c.dist.base === 0, `${r}: 3중첩이어도 데미지 0 (클램프 1 아님)`)
}

console.log('중첩')
for (const n of [2, 3]) {
  const c = computeDotCast(tick, 'none', { kind: 'physical', def: 100, levelPenalty: 0 }, n)
  check(c.totalRange.min === 4800 * n && c.totalRange.max === 11110 * n, `${n}중첩 범위 ${n}배 (${c.totalRange.min}~${c.totalRange.max})`)
  check(c.lineRanges.length === 1, `${n}중첩: 타수는 1줄`)
  check(Math.abs(c.dist.p.reduce((a, x) => a + x, 0) - 1) < 1e-9, `${n}중첩: 확률 합 1`)
  const mean = (4800 + 11110) / 2 * n
  check(Math.abs(expectedValue(c.dist) - mean) <= c.dist.step, `${n}중첩: 평균 ${mean} (${expectedValue(c.dist).toFixed(1)})`)
}

console.log('HP 1 상한')
const main = uniformDist(1000, 2000, 2)
const point = capDist(noDef.dist, 3000 - 1)
check(point.base === 2999 && point.p.length === 1, '틱 전체가 HP를 넘으면 HP−1 한 점')
const partial = capDist(noDef.dist, 8000 - 1)
const top = partial.base + (partial.p.length - 1) * partial.step
check(top <= 7999, `부분 초과: 상한 이하 (${top})`)
check(Math.abs(partial.p.reduce((a, x) => a + x, 0) - 1) < 1e-9, '부분 초과: 확률 합 1')
check(computeNhit(main, 3000, 10, point).zero === 0, '틱만으로는 0방 처치 없음')
check(computeNhit(main, 8000, 10, partial).zero === 0, '격자가 달라도 0방 처치 없음')
const oneHit = computeNhit(main, 3000, 10, point).exact[0]
check(Math.abs(oneHit - 1) < 1e-9, `HP 1이 남으면 메인 1방으로 처치 (${oneHit})`)
check(capDist(noDef.dist, 1_000_000) === noDef.dist, '상한 아래면 분포 그대로')

console.log('스킬 목록')
const JOBS: [JobId, number][] = [['nightLord', 4120005], ['shadower', 4220005], ['nightWalker', 14110004]]
for (const [job, id] of JOBS) {
  const list = damageSkillsForJob(job)
  const v2 = variantSkillId(id, 'venom2')
  const v3 = variantSkillId(id, 'venom3')
  const names = [id, v2, v3].map((x) => list.find((s) => s.id === x)?.description?.name)
  check(names.join('/') === '베놈 (1중첩)/베놈 (2중첩)/베놈 (3중첩, 최대)', `${job}: ${names.join(' / ')}`)
  check(list.filter((s) => s.description?.name === '베놈').length === 0, `${job}: 이름 없는 베놈 항목 없음`)
  check([id, v2, v3].map(venomStacks).join() === '1,2,3', `${job}: 중첩 수 판정`)
  check(baseSkillId(v2) === id && baseSkillId(v3) === id, `${job}: 변형 id 왕복`)
  const att = skillAttackAt(list.find((s) => s.id === v3)!, 20)
  check((att?.spellAtk ?? 0) > 0, `${job}: 변형도 스킬 공격력 조회 (${att?.spellAtk})`)
  const ctx: SpeedContext = { weaponSpeedStep: 6, boosterSteps: 0, castBoostSteps: 0, windBoostSteps: 0, skillLevel: 20, kind: 'magic' }
  check(attacksPerMinute(id, ctx) == null, `${job}: 공속 미산출`)
}
check(VENOM_SKILLS.size === 3, '베놈 3종')
check(venomStacks(5121007) === 1 && variantKindOf(variantSkillId(32121002, 'stun')) === 'stun', '다른 스킬·변형에 영향 없음')

console.log(fail ? `\n실패 ${fail}건` : '\n전부 통과')
process.exit(fail ? 1 : 0)
