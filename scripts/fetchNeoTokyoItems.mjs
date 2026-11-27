/**
 * 네오 도쿄 신규 아이템을 maplearchive.app(JMS)에서 받아 카탈로그에 병합.
 *
 * 네오 도쿄는 KMS에 없던 지역이라 maplestory.io KMS 300에 한글명이 없다. 수치는 몬스터와 같은
 * 기준으로 JMS 152(없으면 첫 등장 버전 — 너클은 164)를 쓰고, 한글명은 메랜 표기를 손으로 적는다.
 * (드래곤 칸쟈르·크리스탈 일비·아머 피어싱 불릿·저지먼트는 maplestory.io GMS 62/200과 수치 일치 확인)
 *
 *  - 스피어 글레이브(スフィアグレイヴ) / 플레어 글레이브(フレアグレイヴ) — 전 무기 종류 시리즈.
 *    두 시리즈는 WZ 수치가 완전히 같다. 건은 시리즈에 없고 저지먼트가 그 자리다(플레어는 단검도 없음).
 *  - 원작 WZ의 아이템 레벨업(level.info)은 메랜 적용 여부가 불확실해 넣지 않는다.
 *  - 아이콘은 maplestory.io JMS 368.
 *  - 기존 id는 건너뛴다. 실행 즉시 파일을 덮어쓴다.
 *
 * 실행: node scripts/fetchNeoTokyoItems.mjs
 */
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const MA = 'https://maplearchive.app/api'
const CATALOG = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'catalog')
const ICON = (id) => `https://maplestory.io/api/jms/368/item/${id}/icon`

const SPHERE = [1302108, 1312040, 1322066, 1332082, 1372047, 1382063, 1402054, 1412036, 1422040, 1432051, 1442072, 1452063, 1462057, 1472078, 1482036]
const FLARE = [1302109, 1312041, 1322067, 1372048, 1382064, 1402055, 1412037, 1422041, 1432052, 1442073, 1452064, 1462058, 1472079, 1482035]

/** [id, 한글명, 카탈로그 파일(slot)] */
const ITEMS = [
  ...SPHERE.map((id) => [id, '스피어 글레이브', 'weapon']),
  ...FLARE.map((id) => [id, '플레어 글레이브', 'weapon']),
  [1492031, '저지먼트', 'weapon'],
  [1092049, '드래곤 칸쟈르', 'shield'],
  [2070016, '크리스탈 일비 표창', 'throwingStar'],
  [2330007, '아머 피어싱 불릿', 'bullet'],
]

/** 무기 id 앞 3자리 → weaponType */
const WT_BY_PREFIX = {
  130: 'oneHandedSword', 131: 'oneHandedAxe', 132: 'oneHandedMace', 133: 'dagger',
  137: 'wand', 138: 'staff', 140: 'twoHandedSword', 141: 'twoHandedAxe', 142: 'twoHandedMace',
  143: 'spear', 144: 'polearm', 145: 'bow', 146: 'crossbow', 147: 'claw', 148: 'knuckle', 149: 'gun',
}
const EFFECT_BY_KEY = {
  incSTR: 'STR', incDEX: 'DEX', incINT: 'INT', incLUK: 'LUK', incMHP: 'hp', incMMP: 'mp',
  incPAD: 'pad', incMAD: 'mad', incPDD: 'pdef', incMDD: 'mdef', incACC: 'acc', incEVA: 'eva',
  incSpeed: 'speed', incJump: 'jump', attackSpeed: 'attackSpeed',
}
const REQ_BY_KEY = { reqSTR: 'reqStr', reqDEX: 'reqDex', reqINT: 'reqInt', reqLUK: 'reqLuk' }

async function getJson(url) {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${r.status} ${url}`)
  return r.json()
}

/** JMS 152(없으면 첫 등장) 리비전의 info를 평평한 객체로 */
async function jmsInfo(id) {
  const h = await getJson(`${MA}/items/${id}`)
  const br = h.branches.find((b) => b.region_slug === 'jms')
  if (!br) throw new Error(`JMS 이력 없음: ${id}`)
  const rev = br.revisions.find((r) => r.version_label === '152') ?? br.revisions[0]
  const d = await getJson(`${MA}/items/${id}/revisions/${rev.release_id}`)
  return { version: rev.version_label, info: Object.fromEntries(d.info.map((x) => [x.key, Number(x.value)])) }
}

function toItem(id, name, slot, info) {
  const effects = {}
  for (const [k, e] of Object.entries(EFFECT_BY_KEY)) if (info[k]) effects[e] = info[k]
  const item = { id, name, slot, effects }
  if (info.reqLevel) item.reqLevel = info.reqLevel
  if (info.tuc) item.tuc = info.tuc
  if (info.reqJob) item.reqJob = info.reqJob
  if (slot === 'weapon') item.weaponType = WT_BY_PREFIX[Math.floor(id / 10000)]
  item.iconUrl = ICON(id)
  for (const [k, f] of Object.entries(REQ_BY_KEY)) if (info[k]) item[f] = info[k]
  return item
}

const bySlot = {}
for (const [id, name, slot] of ITEMS) {
  const { version, info } = await jmsInfo(id)
  const item = toItem(id, name, slot, info)
  ;(bySlot[slot] ??= []).push(item)
  console.log(`JMS ${version}`, JSON.stringify(item))
}

for (const [slot, items] of Object.entries(bySlot)) {
  const file = join(CATALOG, `${slot}.json`)
  const list = JSON.parse(await readFile(file, 'utf8'))
  const have = new Set(list.map((x) => x.id))
  const add = items.filter((x) => !have.has(x.id))
  list.push(...add)
  await writeFile(file, JSON.stringify(list, null, 2) + '\n')
  console.log(`${slot}.json: +${add.length} (건너뜀 ${items.length - add.length})`)
}
