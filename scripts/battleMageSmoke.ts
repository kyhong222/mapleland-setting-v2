/**
 * 배틀메이지 스모크.
 *
 *   npx tsx scripts/battleMageSmoke.ts
 *
 * 기대값: OK만 출력. FAIL이 하나라도 있으면 배틀메이지 배선이 깨진 것.
 *
 * 확인하는 것:
 *  §1 직업 규칙 — 레지스탕스는 4차(120) 보너스 AP가 없고, 마법사지만 10레벨에 전직한다
 *  §2 공격 스킬 목록 — 오라 지속 데미지는 빠지고, 블로우는 타수(3~6)를 갖는다
 *  §3 오라 — 어드밴스드가 기본을 대체(supersedes), 선행 오라가 꺼지면 무효(requires)
 *  §4 슈퍼바디 — 켜진 오라에만 강화분이 얹힌다(boostedBy)
 *  §5 숙련도 — 기본 60%, 스태프 마스터리(스태프 장착 시) 80%
 *  §6 마법 다타 — attackCount만큼 라인이 생긴다
 */

import { attackSkillsForJob, findSkillById, skillAttackAt, skillLineCount } from '../src/data/skills'
import { activeBuffEffects } from '../src/store/aggregate'
import type { BuffContext } from '../src/store/aggregate'
import { masteryRatio } from '../src/domain/attackPower'
import { computeCast } from '../src/domain/skillCombat'
import { totalAP, minLevelForClass, maxLevelForOrder } from '../src/domain/stats'

let fails = 0

function expect(label: string, actual: unknown, want: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(want)
  if (!ok) fails++
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label} → ${JSON.stringify(actual)}${ok ? '' : ` (기대 ${JSON.stringify(want)})`}`)
}

/** 배틀메이지 토글만 켠 버프 문맥 */
function ctx(activeBuffs: Record<string, number>, weaponType: BuffContext['weaponType'] = 'staff'): BuffContext {
  return { activeBuffs, appliedBuffs: {}, masteryLevels: {}, jobId: 'battleMage', weaponType }
}

const DARK = '32001003', ADV_DARK = '32120000'
const YELLOW = '32101003', ADV_YELLOW = '32120001'
const BLUE = '32101002', ADV_BLUE = '32110000'
const SUPER_BODY = '32111005'

// ── §1 직업 규칙 ──────────────────────────────────────────────────
console.log('── 직업 규칙 ──')
expect('AP 119/120 (레지스탕스)', [totalAP(119, 'resistance'), totalAP(120, 'resistance')], [604, 609])
expect('AP 120 (모험가는 +5)', totalAP(120, 'explorer'), 614)
expect('최소 레벨 (마법사 모험가 8 / 배틀메이지 10)', [minLevelForClass('magician'), minLevelForClass('magician', 'resistance')], [8, 10])
expect('최대 레벨', maxLevelForOrder('resistance'), 200)

// ── §2 공격 스킬 ─────────────────────────────────────────────────
console.log('\n── 공격 스킬 ──')
const attacks = attackSkillsForJob('battleMage')
expect('어드밴스드 다크 오라는 공격 목록에서 빠진다', attacks.some((s) => s.id === 32120000), false)
expect(
  '블로우 타수 (트리플/쿼드/데스/피니쉬)',
  [32001000, 32101000, 32111002, 32121002].map((id) => skillLineCount(findSkillById(id)!, 1)),
  [3, 4, 5, 6],
)
expect('공격 스킬 수', attacks.length, 9)

// ── §3 오라 ──────────────────────────────────────────────────────
console.log('\n── 오라 ──')
expect('다크 오라 20', activeBuffEffects(ctx({ [DARK]: 20 })).finalDamageP, 10)
expect('어드밴스드 다크 오라 30이 기본을 대체', activeBuffEffects(ctx({ [DARK]: 20, [ADV_DARK]: 30 })).finalDamageP, 20)
expect('선행 다크 오라가 꺼지면 어드밴스드도 무효', activeBuffEffects(ctx({ [ADV_DARK]: 30 })).finalDamageP, undefined)
const yellow = activeBuffEffects(ctx({ [YELLOW]: 20, [ADV_YELLOW]: 30 }))
expect('어드밴스드 옐로우 오라 30 이속/공속', [yellow.speed, yellow.windBoostStep], [40, 2])
// 블루 오라 피격 감소 = 흡수율 (기본 y / 어드밴스드 x) 가정
expect('블루 오라 20 피격 감소', activeBuffEffects(ctx({ [BLUE]: 20 })).incomingDamageReduceP, 30)
const blue = activeBuffEffects(ctx({ [BLUE]: 20, [ADV_BLUE]: 20 }))
expect('어드밴스드 블루 오라 20 피격 감소/물방/마방 (기본 대체)', [blue.incomingDamageReduceP, blue.pdef, blue.mdef], [20, 100, 100])

// ── §4 슈퍼바디 ──────────────────────────────────────────────────
console.log('\n── 슈퍼바디 ──')
// 스태프면 스태프 마스터리가 자동 적용되므로 완드로 확인
expect('슈퍼바디만 켜면 효과 없음', activeBuffEffects(ctx({ [SUPER_BODY]: 20 }, 'wand')), {})
expect('다크 오라 + 슈퍼바디 20', activeBuffEffects(ctx({ [DARK]: 20, [SUPER_BODY]: 20 })).finalDamageP, 30)
expect(
  '어드밴스드 다크 오라 + 슈퍼바디 → 강화는 한 번만',
  activeBuffEffects(ctx({ [DARK]: 20, [ADV_DARK]: 30, [SUPER_BODY]: 20 })).finalDamageP,
  40,
)
const yb = activeBuffEffects(ctx({ [YELLOW]: 20, [ADV_YELLOW]: 30, [SUPER_BODY]: 20 }))
// 슈퍼바디 회피는 회피율 수치(eva)가 아니라 회피 확률(addEvadeP)에 붙는다 (인게임 확인: eva ×1.4 아님)
expect('어드밴스드 옐로우 오라 + 슈퍼바디 이속/공속/추가회피%', [yb.speed, yb.windBoostStep, yb.addEvadeP, yb.eva], [80, 4, 40, undefined])

// ── §5 숙련도 ────────────────────────────────────────────────────
console.log('\n── 숙련도 ──')
const blow = skillAttackAt(findSkillById(32121002)!, 30)!
expect('스킬 자체 숙련도 (기본)', blow.mastery, 0.6)
const staff = activeBuffEffects(ctx({}, 'staff'))
expect('스태프 마스터리 20 (스태프 장착)', [masteryRatio(staff), staff.mad], [0.8, 20])
expect('완드 장착이면 스태프 마스터리 미적용', activeBuffEffects(ctx({}, 'wand')).mastery, undefined)

// ── §6 마법 다타 ─────────────────────────────────────────────────
console.log('\n── 마법 다타 ──')
const cast = (attackCount: number) => computeCast({
  weaponType: 'staff', skillId: 32121002, attackCount, kind: 'magic',
  magic: 1000, int: 800, spellAtk: 60, mastery: 0.8,
  elementMult: 1, skillPercent: 100, damageMult: 1, critProb: 0, critMult: 1,
})
const one = cast(1)!, six = cast(6)!
expect('피니쉬 블로우 6타 → 라인 6개', six.lineRanges.length, 6)
expect('총 데미지 = 1타 × 6', [six.totalRange.min, six.totalRange.max], [one.totalRange.min * 6, one.totalRange.max * 6])

console.log(fails ? `\n${fails}건 실패` : '\n전부 통과')
process.exit(fails ? 1 : 0)
