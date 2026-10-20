/**
 * Mob.wz 파싱 — 지정한 몹 id만 추출해 mobWzData.json에 병합.
 * (v1 mapleland-setting/src/scripts/parseMobWz.mjs 이식. 전체 재생성 대신 대상 id만 갱신)
 *
 * 기본 수치·속성·공격 스킬에 더해 보스·언데드·특수 패턴(1/1·상태이상·시전 스킬)까지 뽑는다.
 * 공격 노드가 없고 info/link가 있는 몹은 링크된 몹의 공격을 읽는다(시전 스킬은 자기 info 기준).
 *
 * @tybys/wz(WASM WZ 파서)는 상시 의존성으로 두면 선택적 네이티브 모듈이
 * 비-Windows에서 빌드 실패하며 rollup 선택 바이너리까지 꼬이므로, 필요할 때만 임시 설치한다.
 *
 * Usage:
 *   npm i -D @tybys/wz@^1.7.1 --ignore-scripts     # 임시 설치
 *   node scripts/parseMobWz.mjs <path-to-Mob.wz> [id1,id2,...|all] [--dry]   # 기본 id=8200004
 *   git checkout -- package.json package-lock.json && npm install # 원복(중요)
 *
 * --dry: 파일을 쓰지 않고 저장된 값과 다른 id만 출력한다. `all`과 함께 쓰면 기존 데이터 전체 대조.
 */
import { init, WzFile, WzMapleVersion } from '@tybys/wz'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const listPath = resolve(__dirname, '../src/data/mobs/mobList.json')
const wzDataPath = resolve(__dirname, '../src/data/mobs/mobWzData.json')

const args = process.argv.slice(2)
const dry = args.includes('--dry')
const [wzFilePath, idArg] = args.filter((a) => a !== '--dry')
if (!wzFilePath) {
  console.error('Usage: node scripts/parseMobWz.mjs <path-to-Mob.wz> [id1,id2,...|all] [--dry]')
  process.exit(1)
}

const readInt = (image, path) => {
  const p = image.getFromPath(path)
  return p && typeof p.wzValue === 'number' ? p.wzValue : undefined
}
const readStr = (image, path) => {
  const p = image.getFromPath(path)
  return p && typeof p.wzValue === 'string' ? p.wzValue : undefined
}
const setIf = (o, k, v) => { if (v !== undefined) o[k] = v }

async function openWz() {
  await init()
  // v83 GMS 파일은 EMS로도 열리지만 일부 이미지(말레이시아 보스 등)가 안 잡혀 GMS를 먼저 시도한다
  for (const ver of [WzMapleVersion.GMS, WzMapleVersion.EMS, WzMapleVersion.BMS, WzMapleVersion.CLASSIC]) {
    const f = new WzFile(wzFilePath, ver)
    const status = await f.parseWzFile()
    if (status === 1 && f.wzDirectory) {
      const names = []
      for (const img of f.wzDirectory.wzImages) { names.push(img.name); if (names.length >= 5) break }
      if (names.some((n) => /^\d+\.img$/.test(n))) {
        console.log(`버전 ${ver} 선택 (샘플: ${names.join(', ')})`)
        return f
      }
    }
    f.dispose()
  }
  return null
}

async function loadImage(dir, mobId) {
  const image = dir.getImageByName(`${mobId}.img`) ?? dir.getImageByName(`${String(mobId).padStart(7, '0')}.img`)
  if (image) await image.parseImage()
  return image
}

const ATTACK_RE = /^(attack|skill)\d+$/i

async function extract(dir, mobId) {
  const image = await loadImage(dir, mobId)
  if (!image) return null

  const e = { id: mobId }
  setIf(e, 'level', readInt(image, 'info/level'))
  setIf(e, 'PADamage', readInt(image, 'info/PADamage'))
  setIf(e, 'MADamage', readInt(image, 'info/MADamage'))
  setIf(e, 'PDDamage', readInt(image, 'info/PDDamage'))
  setIf(e, 'MDDamage', readInt(image, 'info/MDDamage'))
  setIf(e, 'acc', readInt(image, 'info/acc'))
  setIf(e, 'eva', readInt(image, 'info/eva'))
  setIf(e, 'exp', readInt(image, 'info/exp'))
  setIf(e, 'maxHP', readInt(image, 'info/maxHP'))
  if (readInt(image, 'info/boss') === 1) e.boss = 1 // 저장 데이터는 WZ 원값(1) 그대로
  setIf(e, 'elemAttr', readStr(image, 'info/elemAttr'))

  // 공격 노드가 없으면 info/link 대상의 공격을 쓴다
  let atkImage = image
  const link = readStr(image, 'info/link') ?? readInt(image, 'info/link')
  if (link !== undefined && ![...(image.wzProperties ?? [])].some((p) => ATTACK_RE.test(p.name))) {
    atkImage = (await loadImage(dir, Number(link))) ?? image
  }

  const skills = {}
  let deadly = false
  const disease = []
  for (const prop of atkImage.wzProperties ?? []) {
    if (!ATTACK_RE.test(prop.name)) continue
    const n = prop.name
    const s = {}
    setIf(s, 'type', readInt(atkImage, `${n}/info/type`))
    setIf(s, 'magic', readInt(atkImage, `${n}/info/magic`))
    setIf(s, 'elemAttr', readStr(atkImage, `${n}/info/elemAttr`))
    setIf(s, 'PADamage', readInt(atkImage, `${n}/info/PADamage`))
    setIf(s, 'MADamage', readInt(atkImage, `${n}/info/MADamage`))
    setIf(s, 'conMP', readInt(atkImage, `${n}/info/conMP`))
    setIf(s, 'range', readInt(atkImage, `${n}/info/range`))
    if (Object.keys(s).length) skills[n] = s
    if (readInt(atkImage, `${n}/info/deadlyAttack`) === 1) deadly = true
    const d = readInt(atkImage, `${n}/info/disease`)
    if (d !== undefined && !disease.includes(d)) disease.push(d)
  }
  if (Object.keys(skills).length) e.skills = skills
  if (readInt(image, 'info/undead') === 1) e.undead = true
  if (deadly) e.deadly = true
  if (disease.length) e.disease = disease

  const castSkills = []
  for (const p of image.getFromPath('info/skill')?.wzProperties ?? []) {
    const id = readInt(image, `info/skill/${p.name}/skill`)
    if (id !== undefined && !castSkills.includes(id)) castSkills.push(id)
  }
  if (castSkills.length) e.castSkills = castSkills
  return e
}

/** 키 순서·저장 메타(wzVersion)를 무시한 비교 */
function sameEntry(a, b) {
  const norm = (o) => {
    const { wzVersion: _v, ...rest } = o
    return JSON.stringify(rest, (_k, v) =>
      v && typeof v === 'object' && !Array.isArray(v)
        ? Object.fromEntries(Object.entries(v).sort(([x], [y]) => x.localeCompare(y)))
        : v)
  }
  return norm(a) === norm(b)
}

async function main() {
  console.log('WZ 여는 중...', wzFilePath)
  const wz = await openWz()
  if (!wz?.wzDirectory) { console.error('WZ 파싱 실패'); process.exit(1) }

  const list = JSON.parse(readFileSync(listPath, 'utf-8'))
  const wzData = JSON.parse(readFileSync(wzDataPath, 'utf-8'))
  const targetIds = idArg === 'all'
    ? Object.keys(wzData).map(Number)
    : (idArg ? idArg.split(',') : ['8200004']).map(Number)

  let diff = 0
  for (const id of targetIds) {
    const e = await extract(wz.wzDirectory, id)
    if (!e) { console.warn(`[SKIP] ${id} - .img 없음`); continue }
    if (dry) {
      const cur = wzData[String(id)]
      if (!cur || !sameEntry(cur, e)) {
        diff++
        console.log(`[DIFF] ${id}\n  저장: ${JSON.stringify(cur)}\n  WZ  : ${JSON.stringify(e)}`)
      }
      continue
    }
    wzData[String(id)] = e // 대상만 덮어쓰기(위치 유지)
    const li = list.find((m) => m.id === id)
    if (li && e.level !== undefined) li.level = e.level // 레벨 동기화
    console.log('추출:', JSON.stringify(e))
  }

  if (dry) {
    console.log(`드라이런: ${targetIds.length}건 중 ${diff}건 차이`)
  } else {
    writeFileSync(wzDataPath, JSON.stringify(wzData, null, 2) + '\n', 'utf-8')
    writeFileSync(listPath, JSON.stringify(list, null, 2) + '\n', 'utf-8')
    console.log('mobWzData.json / mobList.json 갱신 완료')
  }
  wz.dispose()
}

main().catch((e) => { console.error(e); process.exit(1) })
