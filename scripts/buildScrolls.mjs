/**
 * 표준 주문서(100/60/10) 데이터 빌더.
 *
 * maplestory.io에서 armor scroll + weapon scroll을 수집해 표준 주문서만 추려
 * src/data/scrolls.json (ScrollDef 배열)로 저장한다.
 *
 * 규칙:
 *  - 확률 100/60/10만 (70/30/65/15/이벤트 등 제외)
 *  - 효과는 GMS 62 metaInfo 기준, 표시명은 KMS 300 한글명(성공률 접미사 제거)
 *  - 표준명("...주문서")만 채택 → 드래곤의 돌/구슬 등 특수템 자동 제외
 *  - 어둠/전용/[이벤트] 제외
 *  - 같은 (대상+이름) 그룹에 같은 rate가 중복이면(추가 100% 등) id 최소값만 채택
 *  - 무기 주문서는 weaponType 단위, 방어구/장신구는 slot 단위
 *
 * Usage: node scripts/buildScrolls.mjs
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.resolve(__dirname, '..', 'src', 'data', 'scrolls.json')
const BASE = 'https://maplestory.io/api'

const STAT_MAP = {
  incSTR: 'STR', incDEX: 'DEX', incINT: 'INT', incLUK: 'LUK',
  incMHP: 'hp', incMMP: 'mp', incPAD: 'pad', incMAD: 'mad',
  incPDD: 'pdef', incMDD: 'mdef', incACC: 'acc', incEVA: 'eva',
  incSpeed: 'speed', incJump: 'jump',
}

/** armor scroll subCategory → SlotId */
const SLOT_SUB = {
  Helmet: 'hat', Face: 'faceAccessory', Eye: 'eyeAccessory', Earrings: 'earring',
  Topwear: 'top', Bottomwear: 'bottom', Overall: 'overall', Shoes: 'shoes',
  Gloves: 'gloves', Cape: 'cape', Shield: 'shield', Pendant: 'pendant', Pet: 'petAcc',
}
/** weapon scroll subCategory → WeaponType */
const WEAPON_SUB = {
  'One-Handed Sword': 'oneHandedSword', 'One-Handed Axe': 'oneHandedAxe', 'One-Handed BW': 'oneHandedMace',
  'Two-Handed Sword': 'twoHandedSword', 'Two-Handed Axe': 'twoHandedAxe', 'Two-Handed BW': 'twoHandedMace',
  Spear: 'spear', Polearm: 'polearm', Dagger: 'dagger', Claw: 'claw', Bow: 'bow', Crossbow: 'crossbow',
  Knuckle: 'knuckle', Gun: 'gun', Wand: 'wand', Staff: 'staff',
}
const STD_RATES = new Set([100, 60, 10])

// ── 수동 보정 (메이플랜드 기준) ──
/** 제거할 주문서 군 이름 */
const REMOVE_NAMES = new Set([
  '투구 명중률 주문서',
  '얼굴 체력 주문서',
  '얼굴 회피율 주문서',
  '눈장식 지력 주문서',
  '망토 마나 주문서',
  '망토 방어력 주문서',
  '망토 마법방어력 주문서',
  '방패 공격력 주문서',
  '방패 마력 주문서',
  '한손검 마력 주문서',
  '펫장비 힘 주문서',
  '펫장비 지력 주문서',
  '펫장비 민첩 주문서',
  '펫장비 행운 주문서',
  '장갑 체력 주문서',
  '장갑 마력 주문서',
])
/** 특정 게임 아이템 id가 포함된 군 제거 (신발 민첩 100%만짜리: 2040709) */
const REMOVE_ITEM_IDS = new Set([2040709])
/** 이름 변경 (변경 전 → 변경 후) */
const RENAME = { '신발 회피 주문서': '신발 민첩 주문서' }

/** 자동생성을 버리고 OVERRIDES로 대체할 슬롯 */
const OVERRIDE_SLOTS = new Set(['eyeAccessory'])
/**
 * 슬롯 오버라이드(메이플랜드 커스텀 정의).
 * 눈 장식: GMS62엔 명중/지력만 있어 메이플랜드 기준으로 재정의.
 * 체력/회피는 실제 게임 아이템이 없어 itemId 생략(아이콘 없음).
 */
const OVERRIDES = [
  {
    key: 'slot:eyeAccessory::눈 장식 명중률 주문서', name: '눈 장식 명중률 주문서', slot: 'eyeAccessory',
    options: [
      { rate: 100, effects: { acc: 1 }, itemId: 2040202 },
      { rate: 60, effects: { acc: 2 }, itemId: 2040201 },
      { rate: 10, effects: { acc: 3 }, itemId: 2040200 },
    ],
  },
  {
    key: 'slot:eyeAccessory::눈 장식 체력 주문서', name: '눈 장식 체력 주문서', slot: 'eyeAccessory',
    options: [
      { rate: 100, effects: { hp: 10 } },
      { rate: 60, effects: { hp: 20 } },
      { rate: 10, effects: { hp: 30 } },
    ],
  },
  {
    key: 'slot:eyeAccessory::눈 장식 회피 주문서', name: '눈 장식 회피 주문서', slot: 'eyeAccessory',
    options: [
      { rate: 100, effects: { eva: 1 } },
      { rate: 60, effects: { eva: 2 } },
      { rate: 10, effects: { eva: 3 } },
    ],
  },
  // 특정 아이템 전용 주문서 (slot/weaponType 없이 itemIds로 한정)
  {
    key: 'item::드래곤의 돌', name: '드래곤의 돌', itemIds: [1122000], // 혼테일의 목걸이
    options: [
      { rate: 100, effects: { STR: 15, DEX: 15, INT: 15, LUK: 15, pdef: 140, mdef: 140, eva: 15 }, itemId: 2041200 },
    ],
  },
  {
    key: 'item::슈피겔만의 구슬', name: '슈피겔만의 구슬', itemIds: [1122007], // 슈피겔만의 목걸이
    options: [
      { rate: 60, effects: { hp: 30, mp: 30 }, itemId: 2041211 },
    ],
  },
  {
    key: 'item::지혜의 돌', name: '지혜의 돌', itemIds: [1122010], // 호루스의 눈
    options: [
      { rate: 60, effects: { hp: 70, mp: 70 }, itemId: 2041212 },
    ],
  },
]

/** KMS 300에 이름이 없는 GMS 전용 주문서용: subCategory → 한글 부위/무기명 */
const SUBCAT_KR = {
  Helmet: '투구', Face: '얼굴', Eye: '눈장식', Earrings: '귀 장식', Topwear: '상의',
  Bottomwear: '하의', Overall: '전신 갑옷', Shoes: '신발', Gloves: '장갑', Cape: '망토',
  Shield: '방패', Pendant: '펜던트', Pet: '펫장비',
  'One-Handed Sword': '한손검', 'One-Handed Axe': '한손도끼', 'One-Handed BW': '한손둔기',
  'Two-Handed Sword': '두손검', 'Two-Handed Axe': '두손도끼', 'Two-Handed BW': '두손둔기',
  Spear: '창', Polearm: '폴암', Dagger: '단검', Claw: '아대', Bow: '활', Crossbow: '석궁',
  Knuckle: '너클', Gun: '건', Wand: '완드', Staff: '스태프',
}
/** 영문 스탯어 → 한글 */
const STAT_KR = {
  DEF: '방어력', Accuracy: '명중률', Avoidability: '회피율', HP: '체력', MaxHP: '체력',
  MP: '마나', MaxMP: '마나', INT: '지력', LUK: '행운', STR: '힘', DEX: '민첩',
  'Weapon Att.': '공격력', 'Weapon Att': '공격력', 'Magic Att.': '마력', 'Magic Att': '마력',
  Jump: '점프력', Speed: '이동속도',
}

/**
 * 표시명 결정.
 *  - KMS명이 있으면 사용하되 '주문서'로 끝나지 않으면 특수템(드래곤의 돌 등) → null(제외)
 *  - KMS명이 없으면 영문 'Scroll for ... for <Stat>'에서 부위(subCategory)+스탯으로 한글 구성
 *  반환: 표시 base 이름 또는 null(제외)
 */
function resolveName(rec) {
  if (rec.kr) {
    const base = baseName(rec.kr)
    return base.endsWith('주문서') ? base : null
  }
  // KMS명 없음 → 영문 패턴으로 구성
  const part = SUBCAT_KR[rec.sub]
  if (!part) return null
  const en = rec.enName || ''
  const idx = en.lastIndexOf(' for ')
  if (idx < 0) return null
  const statWord = en.slice(idx + 5).trim()
  const statKr = STAT_KR[statWord]
  if (!statKr) return null
  return `${part} ${statKr} 주문서`
}

async function getList(cat) {
  const r = await fetch(`${BASE}/gms/62/item/list?startPosition=0&overallCategoryFilter=use&categoryFilter=${cat}`)
  return r.ok ? r.json() : []
}
async function getDetail(id) {
  const r = await fetch(`${BASE}/gms/62/item/${id}`)
  if (!r.ok) return null
  const d = await r.json()
  return d && typeof d === 'object' ? d : null
}
async function getKrName(id) {
  const r = await fetch(`${BASE}/kms/300/item/${id}/name`)
  if (!r.ok) return null
  const d = await r.json()
  if (!d || typeof d !== 'object' || 'error' in d) return null
  return d.name || null
}
function toEffects(meta) {
  const e = {}
  if (!meta) return e
  for (const [k, id] of Object.entries(STAT_MAP)) {
    const v = meta[k]
    if (typeof v === 'number' && v !== 0) e[id] = (e[id] ?? 0) + v
  }
  return e
}
const parseRate = (n) => {
  const m = (n || '').match(/(\d+)\s*%/)
  return m ? Number(m[1]) : null
}
const baseName = (n) => (n || '').replace(/\s*\d+\s*%\s*$/, '').trim()

async function pool(items, size, worker) {
  let i = 0
  const out = []
  async function run() {
    while (i < items.length) {
      const idx = i++
      out[idx] = await worker(items[idx], idx)
    }
  }
  await Promise.all(Array.from({ length: size }, run))
  return out
}

async function main() {
  const [armor, weapon] = await Promise.all([getList('armor%20scroll'), getList('weapon%20scroll')])
  const all = [...armor, ...weapon]
  console.log(`수집: armor ${armor.length} + weapon ${weapon.length} = ${all.length}`)

  let done = 0
  const recs = await pool(all, 14, async (it) => {
    const [detail, kr] = await Promise.all([getDetail(it.id), getKrName(it.id)])
    if (++done % 100 === 0) console.error(`  ...${done}/${all.length}`)
    return {
      id: it.id,
      kr,
      enName: it.name,
      rate: parseRate(kr) ?? parseRate(it.desc) ?? parseRate(it.name),
      sub: it.typeInfo?.subCategory,
      effects: toEffects(detail?.metaInfo),
    }
  })

  // 표준 필터 + 표시명 결정
  const excluded = []
  const kept = []
  for (const r of recs) {
    if (!STD_RATES.has(r.rate) || Object.keys(r.effects).length === 0) continue
    if (!(SLOT_SUB[r.sub] || WEAPON_SUB[r.sub])) continue
    if (/\[.*\]/.test(r.kr || '') || (r.kr || '').includes('전용') || (r.kr || '').includes('어둠')) continue
    const name = resolveName(r)
    if (!name) {
      excluded.push(r)
      continue
    }
    kept.push({ ...r, name })
  }

  // 그룹핑: 대상(slot/weaponType) + 이름
  const groups = new Map()
  for (const r of kept) {
    const wt = WEAPON_SUB[r.sub]
    const slot = wt ? undefined : SLOT_SUB[r.sub]
    const tk = wt ? `weapon:${wt}` : `slot:${slot}`
    const key = `${tk}::${r.name}`
    if (!groups.has(key)) groups.set(key, { key, name: r.name, slot, weaponType: wt, byRate: new Map() })
    const g = groups.get(key)
    // 같은 rate 중복 시 id 최소값(표준 원본) 채택
    const prev = g.byRate.get(r.rate)
    if (!prev || r.id < prev.id) g.byRate.set(r.rate, r)
  }

  const defs = []
  for (const g of groups.values()) {
    const options = [100, 60, 10]
      .filter((rate) => g.byRate.has(rate))
      .map((rate) => {
        const r = g.byRate.get(rate)
        return { rate, effects: r.effects, itemId: r.id }
      })
    const def = { key: g.key, name: g.name, options }
    if (g.weaponType) def.weaponType = g.weaponType
    else def.slot = g.slot
    defs.push(def)
  }
  // ── 수동 보정 적용 ──
  const final = defs
    .filter((d) => !REMOVE_NAMES.has(d.name))
    .filter((d) => !d.options.some((o) => REMOVE_ITEM_IDS.has(o.itemId)))
    .filter((d) => !(d.slot && OVERRIDE_SLOTS.has(d.slot)))
    .map((d) => {
      const newName = RENAME[d.name]
      if (!newName) return d
      const tk = d.weaponType ? `weapon:${d.weaponType}` : `slot:${d.slot}`
      return { ...d, name: newName, key: `${tk}::${newName}` }
    })
    .concat(OVERRIDES)
  final.sort((a, b) => a.key.localeCompare(b.key))

  fs.writeFileSync(OUT, JSON.stringify(final, null, 2) + '\n', 'utf-8')

  const trio = final.filter((d) => d.options.length === 3).length
  console.log(`\n주문서 군 ${final.length}개 (3등급 완비 ${trio}, 일부등급 ${final.length - trio}) → ${path.relative(path.resolve(__dirname, '..'), OUT)}`)
  console.log(`표준 rate인데 제외된 항목 ${excluded.length}건(특수템/미매핑):`)
  for (const r of excluded.slice(0, 20)) console.log(`  - ${r.id} ${r.kr || r.enName} (${r.rate}%, ${r.sub})`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
