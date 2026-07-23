/**
 * 업횟(tuc) 보정 + 누락 목록 리포트.
 *
 * PATCH에 정의된 id의 tuc를 지정값으로 설정하고,
 * 그 외 tuc가 없거나 0인 장비를 목록으로 출력한다.
 *
 * 실행: node scripts/patchMissingTuc.mjs [--write]
 */
import { readFile, writeFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const CATALOG = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'catalog')
const WRITE = process.argv.includes('--write')

/** id → tuc (메이플랜드 확인값) */
const PATCH = {
  1050096: 10, // 그린 카티나스
  1050097: 10, // 블루 카티나스
  1050098: 10, // 레드 카티나스
  1051090: 10, // 그린 카테
  1051091: 10, // 블루 카테
  1051092: 10, // 레드 카테
}

/** 업횟 개념이 없는 파일(소모품/훈장) */
const SKIP = new Set(['arrow.json', 'bolt.json', 'throwingStar.json', 'bullet.json', 'petAcc.json', 'medal.json'])

let patched = 0
const missing = []
const zero = []

for (const f of (await readdir(CATALOG)).filter((x) => x.endsWith('.json')).sort()) {
  const file = join(CATALOG, f)
  const arr = JSON.parse(await readFile(file, 'utf8'))
  let changed = false

  for (const it of arr) {
    if (PATCH[it.id] !== undefined && it.tuc !== PATCH[it.id]) {
      it.tuc = PATCH[it.id]
      changed = true
      patched++
    }
  }
  if (changed && WRITE) await writeFile(file, JSON.stringify(arr, null, 2) + '\n', 'utf8')

  if (SKIP.has(f)) continue
  const slot = f.replace('.json', '')
  for (const it of arr) {
    if (it.tuc === undefined) missing.push({ slot, ...it })
    else if (it.tuc === 0) zero.push({ slot, ...it })
  }
}

const row = (x) => `  ${x.slot.padEnd(14)} ${String(x.id).padEnd(9)} Lv${String(x.reqLevel ?? 0).padEnd(4)} ${x.name}`
console.log(`tuc 패치: ${patched}건${WRITE ? ' (저장됨)' : ' (미리보기)'}\n`)
console.log(`=== tuc 필드 없음 (${missing.length}) ===`)
missing.forEach((x) => console.log(row(x)))
console.log(`\n=== tuc = 0 (${zero.length}) ===`)
zero.forEach((x) => console.log(row(x)))
