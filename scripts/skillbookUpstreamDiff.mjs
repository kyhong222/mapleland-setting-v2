/**
 * 스킬북이 상류(ms-skill-simulator)와 어긋난 곳을 찾는다.
 *
 *   node scripts/skillbookUpstreamDiff.mjs
 *
 * 읽기만 하고 아무것도 쓰지 않는다. 형제 디렉토리 `../ms-skill-simulator`가 있어야 한다
 * (scripts/importSkills.mjs와 같은 경로 규약).
 *
 * 왜 필요한가 — 스킬북은 한 번 포트한 뒤 손으로만 고쳐와서, 상류가 갱신돼도 모르고 지나간다.
 * 실제로 위협은 스킬이 리워크됐는데 우리만 옛 정의를 들고 있었고, 그 탓에 버프 값을 스킬북에서
 * 파생하지 못해 손으로 적어두고 있었다. 버프 레벨표가 스킬북에서 나오는 지금은
 * 스킬북이 낡으면 곧바로 계산이 틀어진다.
 *
 * 상류와 일부러 다르게 두는 것은 EXPECTED_DIVERGENCE에 사유와 함께 적는다.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const UP = path.join(HERE, '..', '..', 'ms-skill-simulator', 'src', 'data', 'skillbooks')
const OURS = path.join(HERE, '..', 'src', 'data', 'skills', 'skillbooks')

/** 상류를 따르지 않기로 한 스킬 — 상류 쪽이 인게임과 맞지 않거나 표기가 깨진 경우다. */
const EXPECTED_DIVERGENCE = new Map([
  // 수치는 상류와 같고 설명 문구만 다르다. 상류가 "#damage%#time"으로 깨져 있어 우리 쪽을 쓴다.
  [3111003, '설명 문구만 다름 — 상류 표기가 깨져 있어 우리 문구 유지 (수치는 동일)'],
  // 에너지 버스터는 스턴을 걸지만 상류 levelProperties에 확률(prop)이 없다.
  // 단독 운용 시 스턴 마스터리가 얼마나 터지는지 계산하려면 필요해 인게임 값(11~40%)을 넣었다.
  [5111002, 'prop(스턴 확률 11~40%) 추가 — 상류에 없어 인게임 값으로 보강 (damage/mobCount는 동일)'],
])

if (!fs.existsSync(UP)) {
  console.error(`상류 레포를 찾을 수 없다: ${UP}`)
  console.error('ms-skill-simulator를 이 레포와 같은 부모 디렉토리에 두어야 한다.')
  process.exit(1)
}

const upFiles = fs.readdirSync(UP).filter((f) => f.endsWith('.json'))
const ourFiles = fs.readdirSync(OURS).filter((f) => f.endsWith('.json'))

/** 메랜에 없는 직업의 스킬북은 애초에 포트하지 않았다 (배틀메이지 3200번대) */
const onlyUpstream = upFiles.filter((f) => !ourFiles.includes(f))

const diffs = []
const expected = []
const missingSkills = []

for (const f of ourFiles) {
  if (!upFiles.includes(f)) continue
  const up = JSON.parse(fs.readFileSync(path.join(UP, f), 'utf8'))
  const our = JSON.parse(fs.readFileSync(path.join(OURS, f), 'utf8'))
  const upById = new Map(up.skills.map((s) => [s.id, s]))

  for (const s of our.skills) {
    const u = upById.get(s.id)
    if (!u) continue
    const name = s.description?.name ?? ''
    const sameProps = JSON.stringify(u.levelProperties) === JSON.stringify(s.levelProperties)
    const sameDetail = (u.description?.detail ?? '') === (s.description?.detail ?? '')
    if (sameProps && sameDetail) continue

    if (EXPECTED_DIVERGENCE.has(s.id)) {
      expected.push(`${f} ${s.id} ${name} — ${EXPECTED_DIVERGENCE.get(s.id)}`)
      continue
    }
    // 어느 필드가 다른지
    const key = (p) => p.hs
    const um = new Map(u.levelProperties.map((p) => [key(p), p]))
    const om = new Map(s.levelProperties.map((p) => [key(p), p]))
    const fields = new Set()
    for (const k of new Set([...um.keys(), ...om.keys()])) {
      const x = um.get(k) ?? {}
      const y = om.get(k) ?? {}
      for (const fld of new Set([...Object.keys(x), ...Object.keys(y)])) {
        if (String(x[fld]) !== String(y[fld])) fields.add(fld)
      }
    }
    diffs.push(
      `${f} ${s.id} ${name}` +
        (sameDetail ? '' : '\n      설명이 다름 (스킬 리워크 가능성)') +
        (fields.size ? `\n      다른 필드: ${[...fields].join(', ')}` : ''),
    )
  }
  for (const u of up.skills) {
    if (!our.skills.some((s) => s.id === u.id)) {
      missingSkills.push(`${f} ${u.id} ${u.description?.name ?? ''}`)
    }
  }
}

console.log(`상류와 다른 스킬: ${diffs.length}건`)
console.log(diffs.length ? diffs.map((d) => `  ${d}`).join('\n') : '  (없음)')

if (expected.length) {
  console.log(`\n일부러 다르게 둔 것: ${expected.length}건`)
  console.log(expected.map((d) => `  ${d}`).join('\n'))
}
if (missingSkills.length) {
  console.log(`\n상류에만 있는 스킬: ${missingSkills.length}건`)
  console.log(missingSkills.map((d) => `  ${d}`).join('\n'))
}
if (onlyUpstream.length) {
  console.log(`\n포트하지 않은 스킬북: ${onlyUpstream.join(', ')} (메랜에 없는 직업)`)
}

process.exit(diffs.length ? 1 : 0)
