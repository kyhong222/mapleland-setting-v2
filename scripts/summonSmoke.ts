/**
 * 수동 스모크 테스트: 소환수 1회 공격 (tsx) — docs/plan.md §특수 스킬 공식
 *  - 물리 소환수 공식 손계산 대조 (DEX×2.5+STR)×AttackRate/100
 *  - 마법 소환수 공식 손계산 대조 (mnwvs077 v0.77, 미검증) + 마력 상한 1999
 *  - 속성배율만 적용(방어 무시), 1줄
 *  - 직업별 목록 포함 · '(1회 공격)' 표기 · 계수/속성 조회
 */
import { damageSkillsForJob } from '../src/data/skills/variants'
import { skillAttackAt, skillDisplayName, SUMMON_SKILL_IDS } from '../src/data/skills'
import { calcMagicSummon, calcSummon } from '../src/domain/attackPower'
import { computeSummonCast } from '../src/domain/skillCombat'
import type { JobId } from '../src/domain/jobs'

let fail = 0
const check = (ok: boolean, msg: string) => {
  if (!ok) fail++
  console.log(ok ? '  ✓' : '  ✗', msg)
}

console.log('물리 소환수 공식')
// DEX 1000, STR 4, 공격력 500: MAX (2500+4)×5 = 12520, MIN (1750+4)×5 = 8770
const phys = calcSummon(1000, 4, 500)
check(phys.max === 12520 && phys.min === 8770, `MAX 12520 / MIN 8770 (${phys.max} / ${phys.min})`)

console.log('마법 소환수 공식')
// 마력 1000, INT 800, mad 270, mastery 10
//   고정분 = 800×0.6 + (1000×0.058)² = 480 + 3364 = 3844, R당 = 3.3×270×0.015 = 13.365
//   MAX = 3844 + 1000×13.365 = 17209 / MIN = 3844 + 1000×0.54×13.365 = 11061.1
const mag = calcMagicSummon(1000, 800, 270, 10)
check(Math.floor(mag.max) === 17209 && Math.floor(mag.min) === 11061, `MAX 17209 / MIN 11061 (${mag.max} / ${mag.min})`)
const capped = calcMagicSummon(2500, 800, 270, 10)
const atCap = calcMagicSummon(1999, 800, 270, 10)
check(capped.max === atCap.max && capped.min === atCap.min, '마력 상한 1999')
// 바하뮤트 Lv1 mastery 1 → 하한 계수 (5+10)×0.009 = 0.135
const bah = calcMagicSummon(1000, 0, 100, 1)
check(Math.abs(bah.min - (3364 + 1000 * 0.135 * 4.95)) < 1e-6, `mastery 1 하한 0.135 (${bah.min.toFixed(2)})`)

console.log('시전 결과 (속성만, 방어 무시)')
const none = computeSummonCast(mag, 1)
check(none.totalRange.min === 11061 && none.totalRange.max === 17209, `무속성 ${none.totalRange.min}~${none.totalRange.max}`)
check(none.lineRanges.length === 1, '1회 공격 = 1줄')
const weak = computeSummonCast(mag, 1.5)
check(weak.totalRange.min === 16591 && weak.totalRange.max === 25813, `약점 ×1.5 ${weak.totalRange.min}~${weak.totalRange.max}`)
const big = computeSummonCast({ min: 300000, max: 400000 }, 1)
check(big.totalRange.max === 199999, '상한 199999')

console.log('직업별 목록')
const EXPECT: [JobId, number, string, 'physical' | 'magic', string | undefined][] = [
  ['bowmaster', 3121006, '피닉스', 'physical', 'F'],
  ['marksman', 3221005, '프리져', 'physical', 'I'],
  ['captain', 5211001, '옥토퍼스', 'physical', undefined],
  ['captain', 5211002, '가비오타', 'physical', undefined],
  ['archMageFP', 2121005, '엘퀴네스', 'magic', 'I'],
  ['archMageIL', 2221005, '이프리트', 'magic', 'F'],
  ['flameWizard', 12111004, '이프리트', 'magic', 'F'],
  ['bishop', 2321003, '바하뮤트', 'magic', 'H'],
]
check(SUMMON_SKILL_IDS.size === EXPECT.length, `소환수 ${EXPECT.length}종`)
for (const [job, id, name, kind, element] of EXPECT) {
  const sk = damageSkillsForJob(job).find((s) => s.id === id)
  check(!!sk, `${job}: ${name} 목록 포함`)
  if (!sk) continue
  check(skillDisplayName(sk) === `${name} (1회 공격)`, `표기 '${skillDisplayName(sk)}'`)
  const att = skillAttackAt(sk, sk.masterLevel)
  const coef = att ? (att.kind === 'magic' ? att.spellAtk : att.skillPercent) : 0
  check(!!att?.summon && att.kind === kind && coef > 0, `${name} ${kind} 계수 ${coef}`)
  check(att?.element === element, `${name} 속성 ${att?.element ?? '무속성'}`)
}
check(!damageSkillsForJob('bishop').some((s) => s.description?.name === '서먼 드래곤'), '서먼 드래곤 제외')
check(!damageSkillsForJob('bowmaster').some((s) => s.id === 3111005), '실버 호크 제외(미지원)')
const ps = damageSkillsForJob('hero').find((s) => s.description?.name === '파워 스트라이크')
check(!!ps && skillDisplayName(ps) === '파워 스트라이크' && !skillAttackAt(ps, 20)?.summon, '일반 스킬 영향 없음')

console.log(fail ? `\n실패 ${fail}건` : '\n전부 통과')
process.exit(fail ? 1 : 0)
