/**
 * 버프 파생 스모크 — 버프 레벨표가 스킬북에서 제대로 파생되는지 확인한다.
 *
 *   npx tsx scripts/buffDeriveSmoke.ts
 *
 * 기대값: OK만 출력. FAIL이 하나라도 있으면 파생 규칙이나 스킬북 데이터가 깨진 것.
 *
 * 여기서 잡으려는 사고는 "값을 두 벌 유지하다 한쪽만 갱신되는" 것이다. 실제로
 * 엘리먼트 엠플리피케이션이 스킬북만 150%로 갱신되고 버프 JSON은 140% 그대로라
 * 몇 주간 낮게 계산됐다. 그래서 §2에서 "스킬북에 있는데 파생을 안 쓰는 버프"를
 * 전부 훑어 경고한다 — 새 사본이 생기면 여기서 걸린다.
 */

import fs from 'fs'
import path from 'path'

import { ALL_BUFFS } from '../src/data/buff'
import { findSkillById } from '../src/data/skills'
import type { SkillBuff } from '../src/domain/buff'

let fails = 0

function expect(label: string, actual: unknown, want: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(want)
  if (!ok) fails++
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label} → ${JSON.stringify(actual)}${ok ? '' : ` (기대 ${JSON.stringify(want)})`}`)
}

const skillBuffs = ALL_BUFFS.filter((b): b is SkillBuff => b.type === 'skill')
const at = (id: string, lv: number) => {
  const b = skillBuffs.find((x) => x.id === id)
  return b?.effectsByLevel[lv - 1]
}

// ── §1 인게임 실측값 대조 ──────────────────────────────────────────
console.log('── 인게임 값 대조 ──')
// 엘리먼트 엠플리피케이션 30레벨 = 마법 데미지 150% (스킬북 y=150 → +50%)
expect('앰플 불독 lv30', at('2110001', 30)?.amplifiedMagicDamageP, 50)
expect('앰플 썬콜 lv30', at('2210001', 30)?.amplifiedMagicDamageP, 50)
expect('앰플 불독 lv1', at('2110001', 1)?.amplifiedMagicDamageP, 7)
// 블로킹 30레벨 = 20% (스킬북 prop을 인게임 값으로 교정해 둠)
expect('블로킹 크루세이더 lv30', at('1120005', 30)?.blockRate, 20)
expect('블로킹 팔라딘 lv20', at('1220006', 20)?.blockRate, 10)
// 소드 마스터리 20레벨 = 숙련도 50% (실효 숙련도 = (10 + 50)/100 = 0.6)
expect('소드 마스터리 lv20', at('1100000', 20)?.mastery, 50)
// 보우 엑스퍼트 30레벨 = 마스터리와 합산해 숙련도 80%
expect('보우 엑스퍼트 lv30 (증가분)', at('3120005', 30)?.mastery, 30)
expect('보우 마스터리 lv20 + 엑스퍼트 lv30', (at('3100000', 20)?.mastery ?? 0) + (at('3120005', 30)?.mastery ?? 0), 80)
// 부스터는 2단계 (스킬북 x = -2)
expect('소드 부스터 lv20', at('1101004', 20)?.attackSpeedBoost, 2)
expect('매직 부스터 lv20', at('2111005', 20)?.castSpeedBoost, 2)
// 아킬레스 30레벨 = 피격 데미지 15% 감소 (스킬북 x = 850/1000)
expect('아킬레스 lv30', at('1120004', 30)?.damageReduce, 15)
// 스탠스 30레벨 = 95% (스킬북 prop)
expect('스탠스 히어로 lv30', at('1121002', 30)?.stanceP, 95)
// 위협 20레벨 = 적 물공/명중 -20%, 받는 데미지 +7%
expect('위협 lv20 물공감소', at('1201006', 20)?.monsterAttackReduceP, 20)
expect('위협 lv20 명중감소', at('1201006', 20)?.monsterAccReduceP, 20)
expect('위협 lv20 받는뎀증가', at('1201006', 20)?.monsterDamageTakenP, 7)

// ── §2 사본 탐지: 스킬북에 있는데 레벨값을 JSON에 직접 적어둔 버프 ────
// 런타임 Buff에는 derive가 남지 않으므로 JSON 원본을 직접 본다.
console.log('\n── 스킬북 사본 탐지 ──')
const BUFF_DIR = path.resolve(import.meta.dirname, '../src/data/buff')
/**
 * 파생하지 않고 직접 값을 두는 것이 맞는 효과 — 스킬북에 대응 필드가 없다.
 *  - 메소 가드 damageReduce: WZ x는 "메소로 방어하는 비율", 데미지 감소 50%는 인게임 고정
 */
const ALLOWED_LITERAL = new Set(['4211005:damageReduce'])

const copies: string[] = []
for (const dir of ['common', 'enhancement', 'jobSpecific']) {
  for (const file of fs.readdirSync(path.join(BUFF_DIR, dir))) {
    if (!file.endsWith('.json')) continue
    const list = JSON.parse(fs.readFileSync(path.join(BUFF_DIR, dir, file), 'utf8'))
    if (!Array.isArray(list)) continue
    for (const b of list) {
      if (!b.effectsByLevel || !findSkillById(Number(b.id))) continue
      const keys = [...new Set(b.effectsByLevel.flatMap((e: object) => Object.keys(e)))]
      const bad = keys.filter((k) => !ALLOWED_LITERAL.has(`${b.id}:${k}`))
      if (bad.length) copies.push(`${b.id} ${b.name}: ${bad.join(',')}`)
    }
  }
}
expect('스킬북과 값이 중복된 버프', copies, [])

// ── §3 파생 표 형태 검사 ──────────────────────────────────────────
console.log('\n── 레벨표 형태 ──')
const badLength = skillBuffs.filter(
  (b) => !b.variants && b.effectsByLevel.length !== b.masterLevel,
)
expect('masterLevel과 길이가 다른 버프', badLength.map((b) => `${b.id} ${b.name}`), [])
const nonFinite = skillBuffs.filter((b) =>
  b.effectsByLevel.some((e) => Object.values(e).some((v) => !Number.isFinite(v))),
)
expect('숫자가 아닌 효과값을 가진 버프', nonFinite.map((b) => `${b.id} ${b.name}`), [])
/**
 * 효과표가 비어 있어도 되는 버프 — 수치를 EffectMap이 아니라 도메인에서 스킬북으로
 * 직접 계산한다(콤보 comboFinalDamageP, 차지 chargeCombinedCoef, 엘리멘탈 리셋 skillNumAt).
 * 버프 쪽은 토글/레벨 선택 UI 역할만 한다.
 */
const COMPUTED_IN_DOMAIN = new Set([
  '1111002', '1120003', '11111001', '11110005', // 콤보 / 어드밴스드 콤보
  '1220010', // 어드밴스드 차지
  '12101005', // 엘리멘탈 리셋
])
const empty = skillBuffs.filter(
  (b) => !COMPUTED_IN_DOMAIN.has(b.id) && b.effectsByLevel.every((e) => !Object.keys(e).length),
)
expect('효과가 전부 비어 있는 버프', empty.map((b) => `${b.id} ${b.name}`), [])

console.log(fails ? `\n${fails}건 실패` : '\n전부 통과')
process.exit(fails ? 1 : 0)
