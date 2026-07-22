/**
 * 인레이지(1121010) 스펙 변경: 공격력(pad) → 추가공격력(addPad), 전 구간 -10.
 * Lv1 pad 11 → addPad 1 ... Lv30 pad 26 → addPad 16.
 * 실행: node scripts/patchEnrage.mjs
 */
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const FILE = join(HERE, '..', 'src', 'data', 'buff', 'enhancement', 'personal.json')

const arr = JSON.parse(await readFile(FILE, 'utf8'))
const enrage = arr.find((b) => b.id === '1121010')
if (!enrage) throw new Error('인레이지(1121010) 항목을 찾지 못했습니다')

enrage.effectsByLevel = enrage.effectsByLevel.map((e) => {
  const pad = e.pad ?? e.addPad ?? 0
  return { addPad: pad - 10 }
})

await writeFile(FILE, JSON.stringify(arr, null, 2) + '\n', 'utf8')
console.log('인레이지 변환 완료:', enrage.effectsByLevel.map((e) => e.addPad).join(','))
