/**
 * catalog 아이템의 요구치(reqJob, reqLevel)와 업그레이드 횟수(tuc)를
 * maplestory.io API 정규값으로 재수집.
 *
 * 이유: v1의 reqJob은 직업 착용제한 미구현 시절 우회값이라 부정확할 수 있고,
 * tuc(주문서 가능 횟수)는 v1 데이터에 아예 없었음.
 * stats/name/icon은 v1 그대로 두고 req/tuc만 API(metaInfo) 기준으로 덮어쓴다.
 *
 * API: GMS 62 → 없으면 GMS 200 폴백. 둘 다 없으면 기존값 유지.
 * Usage: node scripts/refreshReq.mjs
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CATALOG_DIR = path.resolve(__dirname, '..', 'src', 'data', 'catalog')
const CONCURRENCY = 10

async function fetchReq(id) {
  for (const v of ['62', '200']) {
    let res
    try {
      res = await fetch(`https://maplestory.io/api/gms/${v}/item/${id}`)
    } catch {
      continue
    }
    if (!res.ok) continue
    const d = await res.json()
    if (!d || typeof d !== 'object') continue
    const m = d.metaInfo || {}
    const num = (x) => (typeof x === 'number' ? x : 0)
    return {
      found: true,
      reqJob: typeof m.reqJob === 'number' ? m.reqJob : 0,
      reqLevel: m.reqLevelEquip ?? m.reqLevel ?? 0,
      tuc: typeof m.tuc === 'number' ? m.tuc : null,
      // v1이 시스템적으로 누락한 필드 보충용 (incMHP/incMMP/incSpeed/incJump)
      fill: { hp: num(m.incMHP), mp: num(m.incMMP), speed: num(m.incSpeed), jump: num(m.incJump) },
      pad: num(m.incPAD), // 무기 공격력 누락 점검용
    }
  }
  return { found: false }
}

async function pool(items, size, worker) {
  let i = 0
  async function run() {
    while (i < items.length) {
      const idx = i++
      await worker(items[idx], idx)
    }
  }
  await Promise.all(Array.from({ length: size }, run))
}

async function main() {
  const files = fs
    .readdirSync(CATALOG_DIR)
    .filter((f) => f.endsWith('.json'))
  // {file, items}
  const loaded = files.map((f) => ({
    file: f,
    items: JSON.parse(fs.readFileSync(path.join(CATALOG_DIR, f), 'utf-8')),
  }))
  const all = loaded.flatMap((l) => l.items)
  console.log(`대상 아이템: ${all.length}개 (concurrency ${CONCURRENCY})`)

  let done = 0
  let jobChanged = 0
  let lvlChanged = 0
  let tucSet = 0
  let filled = 0
  let notFound = 0
  const padMissing = [] // 무기인데 공격력(effects.pad) 없음 + API엔 있음 → v1 누락 의심

  await pool(all, CONCURRENCY, async (item) => {
    const r = await fetchReq(item.id)
    done++
    if (done % 200 === 0) console.log(`  ...${done}/${all.length}`)
    if (!r.found) {
      notFound++
      return
    }
    // reqJob
    const oldJob = item.reqJob ?? 0
    if (r.reqJob > 0) {
      if (item.reqJob !== r.reqJob) jobChanged++
      item.reqJob = r.reqJob
    } else {
      if (oldJob !== 0) jobChanged++
      delete item.reqJob
    }
    // reqLevel
    const oldLvl = item.reqLevel ?? 0
    if (r.reqLevel > 0) {
      if (item.reqLevel !== r.reqLevel) lvlChanged++
      item.reqLevel = r.reqLevel
    } else {
      if (oldLvl !== 0) lvlChanged++
      delete item.reqLevel
    }
    // tuc (업그레이드 가능 횟수). 숫자면 0 포함 기록
    if (r.tuc != null) {
      if (item.tuc !== r.tuc) tucSet++
      item.tuc = r.tuc
    }
    // 빈칸 보충: v1이 누락한 hp/mp/speed/jump만 추가(기존 값은 절대 덮어쓰지 않음)
    item.effects = item.effects || {}
    for (const k of ['hp', 'mp', 'speed', 'jump']) {
      if (!(k in item.effects) && r.fill[k] > 0) {
        item.effects[k] = r.fill[k]
        filled++
      }
    }
    // 무기 공격력 누락 보충: 무기는 공격력 0이 불가능 → v1 누락으로 보고 API값으로 채움
    if (item.slot === 'weapon' && !('pad' in item.effects) && r.pad > 0) {
      item.effects.pad = r.pad
      padMissing.push(`${item.id} ${item.name} (pad=${r.pad})`)
    }
  })

  // 키 순서 정규화하여 다시 쓰기 (effects/weaponType/iconUrl 등 보존)
  for (const { file, items } of loaded) {
    fs.writeFileSync(
      path.join(CATALOG_DIR, file),
      JSON.stringify(items, null, 2) + '\n',
      'utf-8',
    )
  }

  console.log(
    `\n완료: reqJob 변경 ${jobChanged}, reqLevel 변경 ${lvlChanged}, tuc 설정 ${tucSet}, 효과 보충(hp/mp/이속/점프) ${filled}, API 미발견 ${notFound}`,
  )
  if (padMissing.length) {
    console.log(`\n무기 공격력 보충 ${padMissing.length}건:`)
    padMissing.forEach((x) => console.log('  - ' + x))
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
