/**
 * 리버스/타임리스 성장 장비를 maplestory.io에서 수집해 카탈로그에 병합.
 *
 *  - KMS 300 이름검색으로 "리버스"/"타임리스" 아이템 id 수집
 *  - 이름이 "리버스 …"/"타임리스 …"로 시작하는 항목만(성장템) 사용
 *  - GMS 62(없으면 200) 스펙에서 스탯/요구치/tuc/무기종류 추출
 *  - src/data/catalog/<slot>.json 에 병합(기존 id는 건너뜀)
 *
 * 실행: node scripts/fetchGrowthItems.mjs
 */
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const B = 'https://maplestory.io/api'
// 스펙 조회 우선순위: GMS 62 → GMS 200 → KMS 300 (KMS 전용 성장템 대응). 성공 지역/버전으로 아이콘 생성.
const SPEC_SOURCES = [['gms', '62'], ['gms', '200'], ['kms', '300']]
const NAME_REGION = 'kms'
const NAME_VERSION = '300'
const CATALOG = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'catalog')

const SLOT_BY_SUB = {
  Hat: 'hat', 'Face Accessory': 'faceAccessory', 'Eye Decoration': 'eyeAccessory',
  Earrings: 'earring', Top: 'top', Bottom: 'bottom', Overall: 'overall', Shoes: 'shoes',
  Glove: 'gloves', Cape: 'cape', Shield: 'shield', Ring: 'ring', Pendant: 'pendant', Medal: 'medal',
}
const WT_BY_SUB = {
  'One-Handed Sword': 'oneHandedSword', 'One-Handed Axe': 'oneHandedAxe', 'One-Handed Blunt Weapon': 'oneHandedMace',
  'Two-Handed Sword': 'twoHandedSword', 'Two-Handed Axe': 'twoHandedAxe', 'Two-Handed Blunt': 'twoHandedMace',
  Spear: 'spear', 'Pole Arm': 'polearm', Dagger: 'dagger', Claw: 'claw', Bow: 'bow', Crossbow: 'crossbow',
  Knuckle: 'knuckle', Gun: 'gun', Wand: 'wand', Staff: 'staff',
}
const EFFECT_BY_META = {
  incSTR: 'STR', incDEX: 'DEX', incINT: 'INT', incLUK: 'LUK', incMHP: 'hp', incMMP: 'mp',
  incPAD: 'pad', incMAD: 'mad', incPDD: 'pdef', incMDD: 'mdef', incACC: 'acc', incEVA: 'eva',
  incSpeed: 'speed', incJump: 'jump', attackSpeed: 'attackSpeed',
}

async function getJson(url) {
  const r = await fetch(url)
  if (!r.ok) return null
  const t = await r.text()
  if (!t || t === 'null') return null
  try { return JSON.parse(t) } catch { return null }
}
async function search(q) {
  const d = await getJson(`${B}/${NAME_REGION}/${NAME_VERSION}/item?searchFor=${encodeURIComponent(q)}&count=400`)
  return Array.isArray(d) ? d : (d?.items ?? [])
}
async function fetchSpec(id) {
  for (const [region, v] of SPEC_SOURCES) {
    const d = await getJson(`${B}/${region}/${v}/item/${id}`)
    if (d && typeof d === 'object') return { spec: d, region, version: v }
  }
  return null
}

function normalize(spec, region, version, koreanName) {
  const meta = spec.metaInfo ?? {}
  const sub = spec.typeInfo?.subCategory
  const slot = SLOT_BY_SUB[sub] ?? (WT_BY_SUB[sub] ? 'weapon' : null)
  if (!slot) return null
  const effects = {}
  for (const field of Object.keys(EFFECT_BY_META)) {
    const raw = meta[field]
    if (typeof raw === 'number' && raw !== 0) {
      const id = EFFECT_BY_META[field]
      effects[id] = (effects[id] ?? 0) + raw
    }
  }
  const item = { id: spec.id, name: koreanName ?? spec.description?.name ?? String(spec.id), slot, effects }
  const reqLevel = meta.reqLevelEquip ?? meta.reqLevel
  if (typeof reqLevel === 'number' && reqLevel > 0) item.reqLevel = reqLevel
  if (typeof meta.reqSTR === 'number' && meta.reqSTR > 0) item.reqStr = meta.reqSTR
  if (typeof meta.reqDEX === 'number' && meta.reqDEX > 0) item.reqDex = meta.reqDEX
  if (typeof meta.reqINT === 'number' && meta.reqINT > 0) item.reqInt = meta.reqINT
  if (typeof meta.reqLUK === 'number' && meta.reqLUK > 0) item.reqLuk = meta.reqLUK
  if (typeof meta.tuc === 'number') item.tuc = meta.tuc
  if (typeof meta.reqJob === 'number' && meta.reqJob > 0) item.reqJob = meta.reqJob
  if (slot === 'weapon' && WT_BY_SUB[sub]) item.weaponType = WT_BY_SUB[sub]
  item.iconUrl = `${B}/${region}/${version}/item/${spec.id}/icon`
  return item
}

async function main() {
  // 1) 성장 아이템 id + 한글명 수집
  const byId = new Map()
  for (const q of ['리버스', '타임리스']) {
    for (const it of await search(q)) {
      if (/^(리버스|타임리스)\s/.test(it.name ?? '')) byId.set(it.id, it.name)
    }
  }
  console.log(`검색된 성장 접두사 아이템: ${byId.size}`)

  // 2) 스펙 조회 → 정규화 (동시성 8)
  const ids = [...byId.keys()]
  const items = []
  let skipped = 0
  const worker = async (queue) => {
    while (queue.length) {
      const id = queue.pop()
      const got = await fetchSpec(id)
      if (!got) { skipped++; continue }
      const item = normalize(got.spec, got.region, got.version, byId.get(id))
      if (item) items.push(item)
      else skipped++
    }
  }
  const queue = [...ids]
  await Promise.all(Array.from({ length: 8 }, () => worker(queue)))
  console.log(`정규화 성공: ${items.length}, 스킵(비장비/미조회): ${skipped}`)

  // 3) 슬롯별 카탈로그 병합 (기존 id 유지)
  const bySlot = {}
  for (const it of items) (bySlot[it.slot] ??= []).push(it)

  let added = 0
  for (const [slot, list] of Object.entries(bySlot)) {
    const file = join(CATALOG, `${slot}.json`)
    let existing = []
    try { existing = JSON.parse(await readFile(file, 'utf8')) } catch { existing = [] }
    const have = new Set(existing.map((x) => x.id))
    const fresh = list.filter((x) => !have.has(x.id)).sort((a, b) => a.id - b.id)
    if (!fresh.length) { console.log(`  ${slot}: 신규 0 (기존 ${existing.length})`); continue }
    const merged = [...existing, ...fresh]
    await writeFile(file, JSON.stringify(merged, null, 2) + '\n', 'utf8')
    added += fresh.length
    console.log(`  ${slot}: +${fresh.length} → ${merged.length} (${fresh.map((f) => f.name).join(', ')})`)
  }
  console.log(`총 신규 추가: ${added}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
