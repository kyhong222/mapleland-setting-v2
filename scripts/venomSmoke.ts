/**
 * 수동 스모크 테스트: 베놈 1틱 (tsx) — docs/nhit-dpm.md §4 베놈
 *  - 공식 손계산 대조
 *  - 독 반응: 약점 ×1 / 반감·무효 ×0
 *  - 추가스킬로 넣었을 때 틱만으로는 처치되지 않음 (HP 1 상한)
 *  - 표시 이름 / 공격 스킬 목록 / DPM 미산출
 */
import { damageSkillsForJob, VENOM_SKILLS } from '../src/data/skills/variants'
import { skillAttackAt } from '../src/data/skills'
import { attacksPerMinute } from '../src/data/attackSpeed'
import type { SpeedContext } from '../src/data/attackSpeed'
import { calcVenom } from '../src/domain/attackPower'
import { computeDotCast, computeNhit } from '../src/domain/skillCombat'
import { capDist, convolve, uniformDist } from '../src/domain/nhitProb'
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

console.log('독 반응')
const none = computeDotCast(tick, 'none')
const weak = computeDotCast(tick, 'weak')
check(none.totalRange.max === 11160 && none.totalRange.min === 4860, '무관: 공식 값 그대로')
check(weak.totalRange.max === 11160 && weak.totalRange.min === 4860, '약점: 추가피해 없음')
for (const r of ['half', 'immune'] as const) {
  const c = computeDotCast(tick, r)
  check(c.totalRange.max === 0 && c.dist.p.length === 1 && c.dist.base === 0, `${r}: 데미지 0`)
}

console.log('HP 1 상한')
const main = uniformDist(1000, 2000, 2)
const point = capDist(none.dist, 3000 - 1)
check(point.base === 2999 && point.p.length === 1, '틱 전체가 HP를 넘으면 HP−1 한 점')
const partial = capDist(none.dist, 8000 - 1)
const top = partial.base + (partial.p.length - 1) * partial.step
check(top <= 7999, `부분 초과: 상한 이하 (${top})`)
check(Math.abs(partial.p.reduce((a, x) => a + x, 0) - 1) < 1e-9, '부분 초과: 확률 합 1')
check(computeNhit(main, 3000, 10, point).zero === 0, '틱만으로는 0방 처치 없음')
check(computeNhit(main, 8000, 10, partial).zero === 0, '격자가 달라도 0방 처치 없음')
const oneHit = computeNhit(main, 3000, 10, point).exact[0]
check(Math.abs(oneHit - 1) < 1e-9, `HP 1이 남으면 메인 1방으로 처치 (${oneHit})`)
const twoTicks = convolve(none.dist, none.dist)
check(capDist(twoTicks, 1_000_000) === twoTicks, '상한 아래면 분포 그대로')
const twoRange = twoTicks.base + (twoTicks.p.length - 1) * twoTicks.step
check(twoTicks.base === 9720 && Math.abs(twoRange - 22320) <= twoTicks.step, `2회 추가 = 2틱 누적 (${twoTicks.base}~${twoRange})`)

console.log('스킬 목록')
const JOBS: [JobId, number][] = [['nightLord', 4120005], ['shadower', 4220005], ['nightWalker', 14110004]]
for (const [job, id] of JOBS) {
  const sk = damageSkillsForJob(job).find((s) => s.id === id)
  check(sk?.description?.name === '베놈 (1틱)', `${job}: ${sk?.description?.name}`)
  const att = sk ? skillAttackAt(sk, sk.masterLevel) : null
  check((att?.spellAtk ?? 0) > 0, `${job}: 스킬 공격력 ${att?.spellAtk}`)
  const ctx: SpeedContext = { weaponSpeedStep: 6, boosterSteps: 0, castBoostSteps: 0, windBoostSteps: 0, skillLevel: 30, kind: 'magic' }
  check(attacksPerMinute(id, ctx) == null, `${job}: 공속 미산출`)
}
check(VENOM_SKILLS.size === 3, '베놈 3종')

console.log(fail ? `\n실패 ${fail}건` : '\n전부 통과')
process.exit(fail ? 1 : 0)
