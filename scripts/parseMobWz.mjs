/**
 * Mob.wz 파싱 — 지정한 몹 id만 추출해 mobWzData.json에 병합.
 * (v1 mapleland-setting/src/scripts/parseMobWz.mjs 이식. 전체 재생성 대신 대상 id만 갱신)
 *
 * @tybys/wz(WASM WZ 파서)는 상시 의존성으로 두면 선택적 네이티브 모듈이
 * 비-Windows에서 빌드 실패하며 rollup 선택 바이너리까지 꼬이므로, 필요할 때만 임시 설치한다.
 *
 * Usage:
 *   npm i -D @tybys/wz@^1.7.1 --ignore-scripts     # 임시 설치
 *   node scripts/parseMobWz.mjs <path-to-Mob.wz> [id1,id2,...]   # 기본 id=8200004
 *   git checkout -- package.json package-lock.json && npm install # 원복(중요)
 */
import { init, WzFile, WzMapleVersion } from '@tybys/wz'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const listPath = resolve(__dirname, '../src/data/mobs/mobList.json')
const wzDataPath = resolve(__dirname, '../src/data/mobs/mobWzData.json')

const wzFilePath = process.argv[2]
if (!wzFilePath) {
  console.error('Usage: node scripts/parseMobWz.mjs <path-to-Mob.wz> [id1,id2,...]')
  process.exit(1)
}
const targetIds = (process.argv[3] ? process.argv[3].split(',') : ['8200004']).map(Number)

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
  for (const ver of [WzMapleVersion.EMS, WzMapleVersion.BMS, WzMapleVersion.GMS, WzMapleVersion.CLASSIC]) {
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

async function extract(dir, mobId) {
  const image = dir.getImageByName(`${mobId}.img`) ?? dir.getImageByName(`${String(mobId).padStart(7, '0')}.img`)
  if (!image) return null
  await image.parseImage()

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
  setIf(e, 'elemAttr', readStr(image, 'info/elemAttr'))

  const skills = {}
  for (const prop of image.wzProperties ?? []) {
    if (!/^(attack|skill)\d+$/i.test(prop.name)) continue
    const n = prop.name
    const s = {}
    setIf(s, 'type', readInt(image, `${n}/info/type`))
    setIf(s, 'magic', readInt(image, `${n}/info/magic`))
    setIf(s, 'elemAttr', readStr(image, `${n}/info/elemAttr`))
    setIf(s, 'PADamage', readInt(image, `${n}/info/PADamage`))
    setIf(s, 'MADamage', readInt(image, `${n}/info/MADamage`))
    setIf(s, 'conMP', readInt(image, `${n}/info/conMP`))
    setIf(s, 'range', readInt(image, `${n}/info/range`))
    if (Object.keys(s).length) skills[n] = s
  }
  if (Object.keys(skills).length) e.skills = skills
  return e
}

async function main() {
  console.log('WZ 여는 중...', wzFilePath)
  const wz = await openWz()
  if (!wz?.wzDirectory) { console.error('WZ 파싱 실패'); process.exit(1) }

  const list = JSON.parse(readFileSync(listPath, 'utf-8'))
  const wzData = JSON.parse(readFileSync(wzDataPath, 'utf-8'))

  for (const id of targetIds) {
    const e = await extract(wz.wzDirectory, id)
    if (!e) { console.warn(`[SKIP] ${id} - .img 없음`); continue }
    wzData[String(id)] = e // 대상만 덮어쓰기(위치 유지)
    const li = list.find((m) => m.id === id)
    if (li && e.level !== undefined) li.level = e.level // 레벨 동기화
    console.log('추출:', JSON.stringify(e))
  }

  writeFileSync(wzDataPath, JSON.stringify(wzData, null, 2) + '\n', 'utf-8')
  writeFileSync(listPath, JSON.stringify(list, null, 2) + '\n', 'utf-8')
  console.log('mobWzData.json / mobList.json 갱신 완료')
  wz.dispose()
}

main().catch((e) => { console.error(e); process.exit(1) })
