/**
 * 건 탄약(불릿/캡슐)을 maplestory.io에서 수집해 v2 ItemData로 저장.
 * v1엔 없는 데이터라 API에서 직접 가져온다(강화 불가, slot=bullet/capsule).
 *
 * Usage: node scripts/fetchAmmo.mjs
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.resolve(__dirname, '..', 'src', 'data', 'catalog')
const BASE = 'https://maplestory.io/api'

const STAT_MAP = {
  incPAD: 'pad', incMAD: 'mad', incSTR: 'STR', incDEX: 'DEX', incINT: 'INT', incLUK: 'LUK',
  incPDD: 'pdef', incMDD: 'mdef', incACC: 'add', incEVA: 'eva',
  incMHP: 'hp', incMMP: 'mp', incSpeed: 'speed', incJump: 'jump',
}

const SOURCES = [
  { slot: 'bullet', out: 'bullet.json', url: `${BASE}/gms/62/item/list?startPosition=0&overallCategoryFilter=Use&categoryFilter=Projectile&subCategoryFilter=Bullet` },
  // 캡슐(블레이즈/글레이스)은 공격력 적용 방식 불명확 → 일단 제외
  // { slot: 'capsule', out: 'capsule.json', url: `${BASE}/gms/62/item/list?startPosition=0&overallCategoryFilter=Use&categoryFilter=Other&subCategoryFilter=Capsule` },
]

async function getJson(url) {
  const r = await fetch(url)
  if (!r.ok) return null
  return r.json()
}
function toEffects(meta) {
  const e = {}
  if (!meta) return e
  for (const [k, id] of Object.entries(STAT_MAP)) {
    const v = meta[k]
    if (typeof v === 'number' && v !== 0) e[id] = v
  }
  return e
}
async function krName(id) {
  const d = await getJson(`${BASE}/kms/300/item/${id}/name`)
  if (!d || typeof d !== 'object' || 'error' in d) return null
  return d.name || null
}

async function main() {
  for (const src of SOURCES) {
    const list = (await getJson(src.url)) || []
    const items = []
    for (const it of list) {
      const detail = await getJson(`${BASE}/gms/62/item/${it.id}`)
      const meta = detail?.metaInfo || {}
      const kr = await krName(it.id)
      const item = {
        id: it.id,
        name: kr || it.name || String(it.id),
        slot: src.slot,
        effects: toEffects(meta),
        iconUrl: `${BASE}/gms/62/item/${it.id}/icon`,
      }
      const reqLevel = meta.reqLevelEquip ?? meta.reqLevel
      if (typeof reqLevel === 'number' && reqLevel > 0) item.reqLevel = reqLevel
      items.push(item)
    }
    fs.writeFileSync(path.join(OUT_DIR, src.out), JSON.stringify(items, null, 2) + '\n', 'utf-8')
    console.log(`${src.slot}: ${items.length} → src/data/catalog/${src.out}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
