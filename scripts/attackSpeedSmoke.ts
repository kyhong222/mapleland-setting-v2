/**
 * 공속표 스모크 — `npx tsx scripts/attackSpeedSmoke.ts`
 *
 * 1. 곡선 값이 전부 30ms(1프레임) 배수인지 — 원자료가 프레임 양자화돼 있다(docs/attack-speed.md §1)
 * 2. 마법 공격 스킬이 빠짐없이 등록됐는지 — 마법은 미등록 시 폴백이 없어 DPM이 조용히 사라진다
 * 3. 평타 곡선으로 폴백되는 물리 스킬 목록 — 의도한 것만 남아 있는지 눈으로 확인
 * 4. 분기 스펙(버스터 레벨 / 익스플로전 2차원 / 비숍 시전속도 하한) 동작
 */

import {
  BASIC_MS,
  NO_SPEED_DATA,
  SKILL_SPEED,
  attackIntervalMs,
  attacksPerMinute,
  effectiveCastStep,
  type SpeedContext,
} from '../src/data/attackSpeed'
import { JOB_SKILLBOOKS, attackSkillsForJob, skillPropsAtLevel } from '../src/data/skills'
import type { JobId } from '../src/domain/jobs'

let failed = 0
const check = (ok: boolean, msg: string) => {
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${msg}`)
  if (!ok) failed++
}

const ctx = (over: Partial<SpeedContext> = {}): SpeedContext => ({
  weaponSpeedStep: 6,
  boosterSteps: 0,
  castBoostSteps: 0,
  windBoostSteps: 0,
  skillLevel: 30,
  kind: 'physical',
  ...over,
})

// ── 1. 프레임 정합 ──────────────────────────────────────────────────────────
/**
 * 메랜 실측 apm에서 역산한 값은 프레임 정합을 보장할 수 없어 제외한다
 * (드래곤 로어 30/분 = 2000ms, 윈드 피어싱 21/분 = 2857ms — docs/attack-speed.md §6 #1·#8).
 */
const MEASURED_FIXED = new Set([1311006, 13111006])
console.log('\n[1] 곡선 값 = 30ms 배수 (원자료가 프레임 양자화)')
{
  const bad: string[] = []
  for (let step = 2; step <= 9; step++) {
    for (const [id, spec] of Object.entries(SKILL_SPEED)) {
      if (MEASURED_FIXED.has(Number(id))) continue
      const kind = spec.type === 'cast' ? 'magic' : 'physical'
      const ms = attackIntervalMs(Number(id), ctx({ weaponSpeedStep: step, kind }))
      if (ms != null && ms % 30 !== 0) bad.push(`${id}@${step}=${ms}`)
    }
  }
  check(bad.length === 0, `30ms 배수 아님: ${bad.join(', ') || '없음'}`)
  check(Object.values(BASIC_MS).every((v) => v % 30 === 0), '평타 곡선 30ms 배수')
}

// ── 2·3. 공격 스킬 커버리지 ────────────────────────────────────────────────
console.log('\n[2] 마법 공격 스킬 등록 여부')
const fallback: string[] = []
const missingMagic: string[] = []
{
  const seen = new Set<number>()
  for (const job of Object.keys(JOB_SKILLBOOKS) as JobId[]) {
    for (const sk of attackSkillsForJob(job)) {
      if (seen.has(sk.id)) continue
      seen.add(sk.id)
      const isMagic = skillPropsAtLevel(sk, 30)?.mad !== undefined
      const name = `${sk.id} ${sk.description?.name}`
      if (NO_SPEED_DATA.has(sk.id)) continue
      if (SKILL_SPEED[sk.id]) continue
      if (isMagic) missingMagic.push(name)
      else fallback.push(name)
    }
  }
  check(missingMagic.length === 0, `미등록 마법 스킬: ${missingMagic.join(', ') || '없음'}`)
}
console.log('\n[3] 평타 곡선으로 폴백되는 물리 스킬 (의도한 것만 있어야 한다)')
console.log('    ※ 패닉·코마·돌진은 NhitPanel의 NO_DPM이라 여기 있어도 DPM은 나가지 않는다')
for (const n of fallback) console.log(`       ${n}`)

// ── 4. 분기 스펙 ───────────────────────────────────────────────────────────
console.log('\n[4] 분기 스펙')
{
  // 스피어 버스터: 1~15레벨 900ms / 16~30레벨 1050ms (6속)
  check(attackIntervalMs(1311001, ctx({ skillLevel: 15 })) === 900, '버스터 15Lv 6속 = 900ms')
  check(attackIntervalMs(1311001, ctx({ skillLevel: 16 })) === 1050, '버스터 16Lv 6속 = 1050ms')

  // 익스플로전: 시전속도 축은 매직부스터, 무기공속 축은 윈드부스터
  const ex = (o: Partial<SpeedContext>) => attackIntervalMs(2111002, ctx({ kind: 'magic', ...o }))
  check(ex({}) === 1800, '익스플로전 노말·6속 = 1800ms')
  check(ex({ castBoostSteps: 2 }) === 1620, '익스플로전 부스터2·6속 = 1620ms')
  check(ex({ weaponSpeedStep: 8 }) === 1920, '익스플로전 노말·8속 = 1920ms')
  check(ex({ weaponSpeedStep: 8, windBoostSteps: 2 }) === 1800, '윈드부스터는 무기공속 축을 깎는다 (8→6속)')
  check(ex({ weaponSpeedStep: 5, windBoostSteps: 2 }) === 1710, '무기공속 축 하한 4 (5−2 → 4속)')

  // 비숍은 매직 부스터가 없어 윈드부스터(−2)만 → 시전속도 4단계가 하한
  check(effectiveCastStep(ctx({ kind: 'magic', windBoostSteps: 2 })) === 4, '비숍(윈드만) 시전속도 하한 4단계')
  check(
    effectiveCastStep(ctx({ kind: 'magic', castBoostSteps: 2, windBoostSteps: 2 })) === 2,
    '스펠+윈드 중첩 → 시전속도 2단계',
  )
  check(attacksPerMinute(2321007, ctx({ kind: 'magic', windBoostSteps: 2 })) === 83.3, '엔젤레이 윈드부스터 = 83.3/분')
  check(attacksPerMinute(2311004, ctx({ kind: 'magic' })) === 57.1, '샤이닝 레이 노말 = 57.1/분')

  // 고정(spamming) · 연사
  check(attacksPerMinute(3121004, ctx()) === 500, '폭풍의 시 = 500/분')
  check(attacksPerMinute(1311006, ctx({ weaponSpeedStep: 2 })) === 30, '드래곤 로어 = 공속 무관 30/분')

  // 미지원
  check(attackIntervalMs(2121001, ctx({ kind: 'magic' })) === null, '빅뱅 = 미지원')
  check(attackIntervalMs(3221001, ctx()) === null, '피어싱 = 미지원')
}

console.log(failed === 0 ? '\n전부 통과\n' : `\n실패 ${failed}건\n`)
process.exit(failed === 0 ? 0 : 1)
