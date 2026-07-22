/**
 * 마왕 발록 PQ 보상 + 카오스 자쿰 투구 + 돌고래 물안경을 maplestory.io에서 수집.
 * 메이플랜드 커스텀 패치(요구스탯/업횟 오버라이드) 반영.
 *
 * 미리보기(쓰기 안 함): node scripts/fetchBalrogItems.mjs
 * 카탈로그 병합:        node scripts/fetchBalrogItems.mjs --write
 */
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const B = 'https://maplestory.io/api'
const SPEC_SOURCES = [['gms', '62'], ['gms', '200'], ['kms', '300']]
const NAME_REGION = 'kms'
const NAME_VERSION = '300'
const CATALOG = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'catalog')
const WRITE = process.argv.includes('--write')

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

const norm = (s) => (s ?? '').replace(/\s+/g, '')

// 대상(공백 무시) → 커스텀 패치
const TARGETS = {
  '카오스자쿰의투구': {},
  '돌고래의물안경': {},
  '베인윙즈': { reqLuk: 68 },
  '베인바이터': { reqDex: 90 },
  '베인슈터': { reqStr: 60 },
  '베인롱보우': { reqStr: 50 },
  '발록의가죽신발': { tuc: 5 },
  '발록의털가죽신발': { tuc: 5 },
}
const SEARCH = ['카오스 자쿰', '돌고래', '베인', '발록']

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
  // 1) 검색으로 대상 id 수집
  const byId = new Map() // id -> { name, key }
  for (const q of SEARCH) {
    for (const it of await search(q)) {
      const key = norm(it.name)
      if (key in TARGETS && !byId.has(it.id)) byId.set(it.id, { name: it.name, key })
    }
  }
  console.log(`대상 매칭: ${byId.size}/${Object.keys(TARGETS).length}`)
  const foundKeys = new Set([...byId.values()].map((v) => v.key))
  for (const k of Object.keys(TARGETS)) if (!foundKeys.has(k)) console.log(`  ⚠ 미발견: ${k}`)

  // 2) 스펙 조회 + 정규화 + 패치
  const items = []
  for (const [id, { name, key }] of byId) {
    const got = await fetchSpec(id)
    if (!got) { console.log(`  ⚠ 스펙 없음: ${name} (${id})`); continue }
    const item = normalize(got.spec, got.region, got.version, name)
    if (!item) { console.log(`  ⚠ 비장비/정규화 실패: ${name} (${id})`); continue }
    const patch = TARGETS[key]
    Object.assign(item, patch) // 커스텀 패치 오버라이드
    item._patch = patch
    items.push(item)
  }

  // 3) 출력 (수집 결과)
  items.sort((a, b) => a.slot.localeCompare(b.slot) || a.id - b.id)
  console.log('\n=== 수집 결과 ===')
  for (const it of items) {
    const { _patch, ...clean } = it
    const req = [
      it.reqLevel ? `Lv${it.reqLevel}` : null,
      it.reqStr ? `STR${it.reqStr}` : null, it.reqDex ? `DEX${it.reqDex}` : null,
      it.reqInt ? `INT${it.reqInt}` : null, it.reqLuk ? `LUK${it.reqLuk}` : null,
    ].filter(Boolean).join(' ')
    const eff = Object.entries(it.effects).map(([k, v]) => `${k}${v > 0 ? '+' : ''}${v}`).join(' ')
    const patchStr = Object.keys(_patch).length ? `  [패치: ${JSON.stringify(_patch)}]` : ''
    console.log(`${it.slot.padEnd(13)} #${it.id} ${it.name}`)
    console.log(`   req: ${req || '-'} | tuc: ${it.tuc ?? '-'}${it.weaponType ? ` | ${it.weaponType}` : ''} | ${eff || '옵션없음'}${patchStr}`)
    void clean
  }

  if (!WRITE) {
    console.log('\n(미리보기 — 카탈로그에 쓰지 않음. 확정하려면 --write)')
    return
  }

  // 4) 슬롯별 병합 (기존 id는 패치만 갱신)
  const bySlot = {}
  for (const it of items) { const { _patch, ...c } = it; void _patch; (bySlot[c.slot] ??= []).push(c) }
  let added = 0, updated = 0
  for (const [slot, list] of Object.entries(bySlot)) {
    const file = join(CATALOG, `${slot}.json`)
    let existing = []
    try { existing = JSON.parse(await readFile(file, 'utf8')) } catch { existing = [] }
    const idx = new Map(existing.map((x, i) => [x.id, i]))
    for (const it of list) {
      if (idx.has(it.id)) { existing[idx.get(it.id)] = it; updated++ }
      else { existing.push(it); added++ }
    }
    existing.sort((a, b) => (a.reqLevel ?? 0) - (b.reqLevel ?? 0) || a.id - b.id)
    await writeFile(file, JSON.stringify(existing, null, 2) + '\n', 'utf8')
    console.log(`  ${slot}: 병합 (신규 ${list.filter((x) => !idx.has(x.id)).length})`)
  }
  console.log(`\n총 신규 ${added}, 갱신 ${updated}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
