/**
 * 인레이지(1121010) 스펙 변경: 개인버프 → 파티버프.
 * enhancement/personal.json 에서 제거하고 enhancement/party.json 으로 이동.
 * scope: personal → party, jobs 필드 제거.
 * 실행: node scripts/moveEnrageToParty.mjs
 */
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const ENH = join(HERE, '..', 'src', 'data', 'buff', 'enhancement')
const PERSONAL = join(ENH, 'personal.json')
const PARTY = join(ENH, 'party.json')

const personal = JSON.parse(await readFile(PERSONAL, 'utf8'))
const party = JSON.parse(await readFile(PARTY, 'utf8'))

if (party.some((b) => b.id === '1121010')) {
  console.log('이미 party.json에 존재 — 변경 없음')
  process.exit(0)
}

const idx = personal.findIndex((b) => b.id === '1121010')
if (idx < 0) throw new Error('personal.json에서 인레이지(1121010)를 찾지 못했습니다')

const src = personal.splice(idx, 1)[0]
// party 항목 키 순서에 맞춰 재구성 (jobs 제거, scope=party)
const moved = {
  id: src.id,
  type: src.type,
  name: src.name,
  scope: 'party',
  mode: src.mode,
  masterLevel: src.masterLevel,
  effectsByLevel: src.effectsByLevel,
  ...(src.icon ? { icon: src.icon } : {}),
}
party.push(moved)

await writeFile(PERSONAL, JSON.stringify(personal, null, 2) + '\n', 'utf8')
await writeFile(PARTY, JSON.stringify(party, null, 2) + '\n', 'utf8')
console.log(`이동 완료: 인레이지 → party.json (party ${party.length}개, personal ${personal.length}개)`)
