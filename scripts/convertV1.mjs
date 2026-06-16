/**
 * v1(kyhong222/mapleland-setting) pre/post 아이템 데이터 → v2 ItemData JSON 변환.
 *
 * 입력:
 *   <V1_ROOT>/src/data/items/<slot>.json        (PreItem 배열: id,name,koreanName,reqJob,reqLevel)
 *   <V1_ROOT>/src/data/postItems/<slot>.json     (PostItem 객체: id → {koreanName,icon,stats,requireStats})
 *   무기는 items/weapons/<weaponType>.json
 * 출력:
 *   src/data/catalog/<SlotId>.json               (v2 ItemData 배열)
 *
 * postItem에 스탯이 이미 있으므로 API 재호출 없이 변환한다.
 * Usage: node scripts/convertV1.mjs [V1_ROOT]
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const V2_ROOT = path.resolve(__dirname, '..')
const V1_ROOT = process.argv[2] || '/tmp/ml-v1'

const V1_ITEMS = path.join(V1_ROOT, 'src', 'data', 'items')
const V1_POST = path.join(V1_ROOT, 'src', 'data', 'postItems')
const OUT_DIR = path.join(V2_ROOT, 'src', 'data', 'catalog')

/** v1 items/ 직속 파일명 → v2 SlotId (badge/emblem 제외) */
const SLOT_FILE_MAP = {
  hat: 'hat',
  faceAccessory: 'faceAccessory',
  eyeDecoration: 'eyeAccessory',
  earrings: 'earring',
  top: 'top',
  bottom: 'bottom',
  overall: 'overall',
  shoes: 'shoes',
  glove: 'gloves',
  cape: 'cape',
  shield: 'shield',
  pendant: 'pendant',
  medal: 'medal',
  belt: 'belt',
  petAcc: 'petAcc',
}

/** v1 weapons/ 파일명 → v2 WeaponType */
const WEAPON_FILE_MAP = {
  oneHandedSword: 'oneHandedSword',
  oneHandedAxe: 'oneHandedAxe',
  oneHandedBlunt: 'oneHandedMace',
  twoHandedSword: 'twoHandedSword',
  twoHandedAxe: 'twoHandedAxe',
  twoHandedBlunt: 'twoHandedMace',
  spear: 'spear',
  polearm: 'polearm',
  dagger: 'dagger',
  claw: 'claw',
  bow: 'bow',
  crossbow: 'crossbow',
  staff: 'staff',
  wand: 'wand',
  // knuckle / gun / specialWeapons / thrownAmmo: 별도 처리(아래 SKIP)
}

/** v1 stats 키 → v2 EffectId (hp/maxHp, mp/maxMp는 동일 EffectId로 합산) */
const STAT_MAP = {
  attack: 'pad',
  str: 'STR',
  dex: 'DEX',
  int: 'INT',
  luk: 'LUK',
  mad: 'mad',
  pdef: 'pdef',
  mdef: 'mdef',
  acc: 'add',
  eva: 'eva',
  attackSpeed: 'attackSpeed',
  hp: 'hp',
  maxHp: 'hp',
  mp: 'mp',
  maxMp: 'mp',
  speed: 'speed',
  jump: 'jump',
}

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf-8'))

function toEffects(stats) {
  const effects = {}
  if (!stats) return effects
  for (const [k, effId] of Object.entries(STAT_MAP)) {
    const v = stats[k]
    if (typeof v === 'number' && v !== 0) {
      effects[effId] = (effects[effId] ?? 0) + v
    }
  }
  return effects
}

/** preItem + postItem → v2 ItemData */
function toItemData(preItem, post, slot, weaponType) {
  const item = {
    id: preItem.id,
    name: post?.koreanName || preItem.koreanName || preItem.name || String(preItem.id),
    slot,
    effects: toEffects(post?.stats),
  }
  const reqLevel = post?.requireStats?.level ?? preItem.reqLevel
  if (typeof reqLevel === 'number' && reqLevel > 0) item.reqLevel = reqLevel
  if (typeof preItem.reqJob === 'number' && preItem.reqJob > 0) item.reqJob = preItem.reqJob
  if (weaponType) item.weaponType = weaponType
  const icon = post?.icon || `https://maplestory.io/api/gms/62/item/${preItem.id}/icon`
  item.iconUrl = icon
  return item
}

/** 한 PreItem 파일을 변환해 ItemData[] 반환 */
function convertFile(preItemPath, postItemPath, slot, weaponType) {
  const preItems = readJson(preItemPath)
  const post = fs.existsSync(postItemPath) ? readJson(postItemPath) : {}
  let noKorean = 0
  const items = preItems.map((pre) => {
    const p = post[String(pre.id)]
    if (!p?.koreanName && !pre.koreanName) noKorean++
    return toItemData(pre, p, slot, weaponType)
  })
  return { items, noKorean, withPost: preItems.filter((p) => post[String(p.id)]).length }
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  // slot → ItemData[] (무기는 모두 weapon으로 병합)
  const bySlot = {}
  const add = (slot, items) => {
    bySlot[slot] = (bySlot[slot] || []).concat(items)
  }

  const summary = []
  let skippedFiles = []

  // 1) 방어구/장신구
  for (const [file, slot] of Object.entries(SLOT_FILE_MAP)) {
    const pre = path.join(V1_ITEMS, `${file}.json`)
    if (!fs.existsSync(pre)) {
      skippedFiles.push(`items/${file}.json (없음)`)
      continue
    }
    const res = convertFile(pre, path.join(V1_POST, `${file}.json`), slot)
    add(slot, res.items)
    summary.push(`${file} → ${slot}: ${res.items.length} (post ${res.withPost}, no-korean ${res.noKorean})`)
  }

  // 2) 무기
  const weaponDir = path.join(V1_ITEMS, 'weapons')
  if (fs.existsSync(weaponDir)) {
    for (const f of fs.readdirSync(weaponDir)) {
      if (!f.endsWith('.json')) continue
      const base = f.replace(/\.json$/, '')
      const weaponType = WEAPON_FILE_MAP[base]
      if (!weaponType) {
        skippedFiles.push(`weapons/${f} (미지원 무기분류)`)
        continue
      }
      const res = convertFile(
        path.join(weaponDir, f),
        path.join(V1_POST, 'weapons', f),
        'weapon',
        weaponType,
      )
      add('weapon', res.items)
      summary.push(`weapons/${base} → weapon(${weaponType}): ${res.items.length} (post ${res.withPost}, no-korean ${res.noKorean})`)
    }
  }

  // 3) 투사체 (강화 불가, 종류별 슬롯). projectiles/claw는 아대 무기라 제외.
  const PROJ_FILE_MAP = {
    arrowAmmo: 'arrow',
    crossbowBoltAmmo: 'bolt',
    thrownAmmo: 'throwingStar',
  }
  const projDir = path.join(V1_ITEMS, 'projectiles')
  if (fs.existsSync(projDir)) {
    for (const [file, slot] of Object.entries(PROJ_FILE_MAP)) {
      const pre = path.join(projDir, `${file}.json`)
      if (!fs.existsSync(pre)) {
        skippedFiles.push(`projectiles/${file}.json (없음)`)
        continue
      }
      const res = convertFile(pre, path.join(V1_POST, 'projectiles', `${file}.json`), slot)
      add(slot, res.items)
      summary.push(`projectiles/${file} → ${slot}: ${res.items.length} (post ${res.withPost}, no-korean ${res.noKorean})`)
    }
  }

  // 출력
  let total = 0
  for (const [slot, items] of Object.entries(bySlot)) {
    // id 중복 제거(뒤 항목 우선)
    const map = new Map(items.map((it) => [it.id, it]))
    const deduped = [...map.values()]
    fs.writeFileSync(path.join(OUT_DIR, `${slot}.json`), JSON.stringify(deduped, null, 2) + '\n', 'utf-8')
    total += deduped.length
    if (deduped.length !== items.length) {
      summary.push(`  (${slot}: dedupe ${items.length} → ${deduped.length})`)
    }
  }

  console.log('=== 변환 요약 ===')
  summary.forEach((s) => console.log(s))
  console.log('--- skipped ---')
  skippedFiles.forEach((s) => console.log(s))
  console.log(`\n총 ${Object.keys(bySlot).length} slot, ${total} items → ${path.relative(V2_ROOT, OUT_DIR)}`)
}

main()
