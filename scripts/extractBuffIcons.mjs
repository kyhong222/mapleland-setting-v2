/**
 * 버프 아이콘(base64/URL/아이템id)을 public/buff-icons/<buffId>.png 로 추출하고
 * 각 버프의 icon 필드를 /buff-icons/<id>.png 로 교체한다.
 *
 * 실행: node scripts/extractBuffIcons.mjs
 */
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const BUFF_DIR = join(HERE, '..', 'src', 'data', 'buff')
const OUT = join(HERE, '..', 'public', 'buff-icons')

async function jsonFiles(dir) {
  const out = []
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) out.push(...(await jsonFiles(p)))
    else if (e.name.endsWith('.json')) out.push(p)
  }
  return out
}

/** 버프 아이콘 → PNG 바이트 (없으면 null) */
async function iconBytes(buff) {
  const ic = buff.icon
  if (typeof ic === 'string') {
    if (ic.startsWith('/')) return null // 이미 로컬
    if (ic.startsWith('data:')) return Buffer.from(ic.split(',')[1] ?? '', 'base64')
    if (ic.startsWith('http')) {
      const r = await fetch(ic)
      return r.ok ? Buffer.from(await r.arrayBuffer()) : null
    }
    // raw base64 (data: 접두사 없음)
    if (!ic.includes('/') && ic.length > 100) return Buffer.from(ic, 'base64')
  }
  // icon 없음 + 아이템 타입 → maplestory.io 아이템 아이콘
  if (!ic && buff.type === 'item') {
    const r = await fetch(`https://maplestory.io/api/gms/62/item/${buff.id}/icon`)
    return r.ok ? Buffer.from(await r.arrayBuffer()) : null
  }
  return null
}

async function main() {
  await mkdir(OUT, { recursive: true })
  let extracted = 0, skipped = 0
  for (const file of await jsonFiles(BUFF_DIR)) {
    const arr = JSON.parse(await readFile(file, 'utf8'))
    if (!Array.isArray(arr)) continue
    let changed = false
    for (const buff of arr) {
      if (!buff || typeof buff !== 'object') continue
      if (typeof buff.icon === 'string' && buff.icon.startsWith('/')) { skipped++; continue }
      const bytes = await iconBytes(buff)
      if (!bytes) { skipped++; continue }
      await writeFile(join(OUT, `${buff.id}.png`), bytes)
      buff.icon = `/buff-icons/${buff.id}.png`
      changed = true
      extracted++
    }
    if (changed) await writeFile(file, JSON.stringify(arr, null, 2) + '\n', 'utf8')
  }
  console.log(`추출: ${extracted}개 → public/buff-icons/ · 스킵: ${skipped}`)
}
main().catch((e) => { console.error(e); process.exit(1) })
