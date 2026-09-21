/**
 * HP/MP 수식 스모크 — 인게임 실측 4건과 대조한다.
 *
 * 기본 HP 13238인 캐릭터, 고정분 205 = 결혼링60 + 메이플이어링25 + 안경20 + 칭호100.
 * 증가율은 정령의 축복 12(10%) · 카오스 자쿰의 투구(10%) · 하이퍼 바디 30(60%).
 *
 *   npx tsx scripts/resourceSmoke.ts
 */

import { resourceTotal, baseFromShown, computeResources } from '../src/domain/resource'
import { getBuff } from '../src/data/buff'
import { buffEffectsAtLevel } from '../src/domain/buff'
import { getItem } from '../src/data/itemRepository'

const BASE_HP = 13238
const FLAT = 60 + 25 + 20 + 100

interface Case {
  label: string
  flat: number
  percent: number
  expected: number
}

const CASES: Case[] = [
  { label: '정축12', flat: 0, percent: 10, expected: 14561 },
  { label: '정축12 + 고정HP장비', flat: FLAT, percent: 10, expected: 14787 },
  { label: '+ 카오스 자쿰의 투구', flat: FLAT, percent: 20, expected: 16131 },
  { label: '+ 하이퍼 바디 30', flat: FLAT, percent: 80, expected: 24197 },
]

async function main() {
  let failed = 0

  console.log('— 수식 대조 (최종 = ⌊(기본 + 고정) × (1 + %/100)⌋)')
  for (const c of CASES) {
    const got = resourceTotal(BASE_HP, c.flat, c.percent)
    const ok = got === c.expected
    if (!ok) failed++
    console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${c.label}: 고정 ${c.flat} / ${c.percent}% -> ${got} (실측 ${c.expected})`)
  }

  console.log('— 역산 대조 (인게임 표시값 -> 기본 HP)')
  for (const c of CASES) {
    const got = baseFromShown(c.expected, c.flat, c.percent)
    const ok = got === BASE_HP
    if (!ok) failed++
    console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${c.label}: ${c.expected} -> 기본 ${got} (기대 ${BASE_HP})`)
  }

  console.log('— 레벨 기록 (입력 당시 레벨에서만 최종치를 낸다)')
  // 정축12 + 고정HP장비 케이스의 효과맵 — 기본 13238이면 14787이 나온다
  const effects = { hp: FLAT, hpP_botf: 10 } as const
  const at = (storedLevel: number | null, level: number) =>
    computeResources(effects, { hp: { value: BASE_HP, level: storedLevel }, mp: { value: null, level: null } }, level).hp

  const levelCases: { label: string; got: ReturnType<typeof at>; total: number | null; stale: number | null }[] = [
    { label: '같은 레벨 — 최종치', got: at(170, 170), total: 14787, stale: null },
    { label: '레벨업 후 — 최종치 없음 + 기록레벨 노출', got: at(170, 171), total: null, stale: 170 },
    { label: '되돌아오면 원래대로', got: at(170, 170), total: 14787, stale: null },
    { label: '구버전(레벨 미기록) — 검사 생략', got: at(null, 171), total: 14787, stale: null },
  ]
  for (const c of levelCases) {
    const ok = c.got.total === c.total && c.got.staleLevel === c.stale
    if (!ok) failed++
    console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${c.label}: total ${c.got.total} / staleLevel ${c.got.staleLevel} (기대 ${c.total} / ${c.stale})`)
  }
  // 레벨이 어긋나도 "지금 얹히는 몫"은 그대로 보여줘야 한다 (미입력과 같은 표기)
  const stale = at(170, 171)
  const partsOk = stale.flat === FLAT && stale.percent === 10 && stale.base === BASE_HP
  if (!partsOk) failed++
  console.log(`  ${partsOk ? 'OK  ' : 'FAIL'} 어긋나도 고정/증가율/보관값은 유지: 고정 ${stale.flat} / ${stale.percent}% / 보관 ${stale.base}`)

  console.log('— 데이터 출처 확인')
  const hat = await getItem(1003112)
  const hatHpP = hat?.effects.hpP ?? 0
  const hb = getBuff('1301007') // 하이퍼 바디
  const hbHpP = hb ? (buffEffectsAtLevel(hb, 30).hpP ?? 0) : 0
  const botf = getBuff('blessingOfFairy') // 정령의 축복
  const botfHpP = botf ? (buffEffectsAtLevel(botf, 12).hpP_botf ?? 0) : 0
  console.log(`  ${hat?.name}: hpP ${hatHpP} (기대 10)`)
  console.log(`  하이퍼 바디 30: hpP ${hbHpP} (기대 60)`)
  console.log(`  정령의 축복 12: hpP_botf ${botfHpP} (기대 10)`)
  if (hatHpP !== 10) failed++
  if (hbHpP !== 60) failed++
  if (botfHpP !== 10) failed++

  console.log(failed === 0 ? '\n전부 통과' : `\n실패 ${failed}건`)
  process.exitCode = failed === 0 ? 0 : 1
}

main()
