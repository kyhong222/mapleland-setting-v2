/**
 * 무기 게이팅 스모크 — 무기 마스터리/엑스퍼트와 무기 부스터가
 * "장착 주무기가 맞을 때만" 적용되는지 확인한다.
 *
 *   npx tsx scripts/weaponGateSmoke.ts
 *
 * 기대값: OK만 출력. 하나라도 FAIL이면 데이터(weaponTypes) 또는 aggregate 게이팅이 깨진 것.
 */

import { activeBuffEffects, appliedMasteries } from '../src/store/aggregate'
import { ALL_BUFFS } from '../src/data/buff'
import { WEAPON_CONSTANTS } from '../src/domain/weapons'
import type { WeaponType } from '../src/domain/weapons'
import type { JobId } from '../src/domain/jobs'

let fails = 0

/** 부스터(공속/시전속도 상승) 적용 여부 */
function boostSteps(jobId: JobId, weaponType: WeaponType | undefined, boosterId: string): number {
  const eff = activeBuffEffects({
    activeBuffs: {},
    appliedBuffs: { [boosterId]: 20 },
    masteryLevels: {},
    jobId,
    weaponType,
  })
  return (eff.attackSpeedBoost ?? 0) + (eff.castSpeedBoost ?? 0) + (eff.windBoostStep ?? 0)
}

function expect(label: string, actual: unknown, want: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(want)
  if (!ok) fails++
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label} → ${JSON.stringify(actual)}${ok ? '' : ` (기대 ${JSON.stringify(want)})`}`)
}

const w = (t: WeaponType) => WEAPON_CONSTANTS[t].label

/** 마스터리: 지정 무기에서 적용되는 마스터리 이름들 */
function masteryNames(jobId: JobId, weaponType?: WeaponType): string[] {
  return appliedMasteries(jobId, weaponType).map((b) => b.name)
}

// ── 마스터리: 한손/두손 양쪽 대응 ────────────────────────────────
const MASTERY_CASES: [JobId, WeaponType, string[]][] = [
  ['hero', 'oneHandedSword', ['소드 마스터리']],
  ['hero', 'twoHandedSword', ['소드 마스터리']],
  ['hero', 'oneHandedAxe', ['엑스 마스터리']],
  ['hero', 'twoHandedAxe', ['엑스 마스터리']],
  ['paladin', 'oneHandedSword', ['소드 마스터리']],
  ['paladin', 'twoHandedSword', ['소드 마스터리']],
  ['paladin', 'oneHandedMace', ['메이스 마스터리']],
  ['paladin', 'twoHandedMace', ['메이스 마스터리']],
  // 창/폴암은 인게임에서도 서로 호환되지 않는다
  ['darkKnight', 'spear', ['스피어 마스터리']],
  ['darkKnight', 'polearm', ['폴암 마스터리']],
  ['soulMaster', 'oneHandedSword', ['소드 마스터리']],
  ['soulMaster', 'twoHandedSword', ['소드 마스터리']],
]
console.log('== 무기 마스터리')
for (const [job, weapon, want] of MASTERY_CASES) {
  expect(`${job} + ${w(weapon)}`, masteryNames(job, weapon), want)
}
expect('darkKnight + 폴암 (스피어 마스터리 비적용)', masteryNames('darkKnight', 'polearm').includes('스피어 마스터리'), false)
expect('hero + 무기 미장착', masteryNames('hero', undefined), [])

// ── 부스터: 맞는 무기에서만 공속 상승 ────────────────────────────
const BOOSTER_CASES: [string, JobId, WeaponType[], WeaponType[]][] = [
  // [부스터 id, 직업, 적용돼야 할 무기, 적용되면 안 되는 무기]
  ['1101004', 'hero', ['oneHandedSword', 'twoHandedSword'], ['oneHandedAxe', 'twoHandedAxe']],
  ['1101005', 'hero', ['oneHandedAxe', 'twoHandedAxe'], ['oneHandedSword', 'twoHandedSword']],
  ['1201004', 'paladin', ['oneHandedSword', 'twoHandedSword'], ['oneHandedMace', 'twoHandedMace']],
  ['1201005', 'paladin', ['oneHandedMace', 'twoHandedMace'], ['oneHandedSword', 'twoHandedSword']],
  ['1301004', 'darkKnight', ['spear'], ['polearm']],
  ['1301005', 'darkKnight', ['polearm'], ['spear']],
  ['11101001', 'soulMaster', ['oneHandedSword', 'twoHandedSword'], []],
  // 매직 부스터도 완드/스태프를 들어야 시전된다
  ['2111005', 'archMageFP', ['wand', 'staff'], ['dagger']],
  ['2211005', 'archMageIL', ['wand', 'staff'], ['dagger']],
  ['12101004', 'flameWizard', ['wand', 'staff'], ['dagger']],
]
console.log('\n== 무기 부스터')
for (const [id, job, yes, no] of BOOSTER_CASES) {
  const name = ALL_BUFFS.find((b) => b.id === id)?.name ?? id
  for (const weapon of yes) expect(`${name}(${job}) + ${w(weapon)} 적용`, boostSteps(job, weapon, id) > 0, true)
  for (const weapon of no) expect(`${name}(${job}) + ${w(weapon)} 미적용`, boostSteps(job, weapon, id), 0)
  expect(`${name}(${job}) + 무기 미장착 미적용`, boostSteps(job, undefined, id), 0)
}

// ── 무기를 가리지 않는 버프는 그대로 적용 ────────────────────────
// 윈드 부스터는 "기존 부스터와 중복하여 사용할 수 있고 파티원 모두 효과를 받는다"
console.log('\n== 무기 제한 없는 버프')
expect('윈드 부스터 + 무기 미장착', boostSteps('hero', undefined, '5121009') > 0, true)
expect('윈드 부스터 + 두손도끼', boostSteps('hero', 'twoHandedAxe', '5121009') > 0, true)

console.log(fails === 0 ? '\n전부 통과' : `\n실패 ${fails}건`)
if (fails > 0) process.exitCode = 1
