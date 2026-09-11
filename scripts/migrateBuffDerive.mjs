/**
 * 일회성 마이그레이션 — 버프 JSON의 effectsByLevel을 스킬북 파생(derive) 선언으로 바꾼다.
 *
 *   node scripts/migrateBuffDerive.mjs          # 드라이런 (변경 없이 보고만)
 *   node scripts/migrateBuffDerive.mjs --write  # 실제 덮어쓰기
 *
 * 규칙은 전부 선형식이다 — 효과값 = WZ필드값 × scale + offset.
 * 1) AUTO  : scale=1/offset 상수로 현재 값이 그대로 재현되면 자동 채택
 * 2) MANUAL: 스케일이 걸린 것(숙련도 ×5, 부스터 ×-1 등)과, 스킬북만 갱신돼
 *            현재 버프 값과 어긋난 것(앰플/스탠스/인레이지)은 여기에 명시
 * 3) 나머지는 effectsByLevel을 그대로 둔다 (스킬북에 근거가 없는 값)
 *
 * 값이 바뀌는 항목은 전부 "값 변경" 목록으로 출력한다. 파생 도입으로 의도한 교정인지
 * 확인하는 용도이므로 그냥 넘기지 말 것.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const WRITE = process.argv.includes('--write')
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BUFF_DIR = path.join(ROOT, 'src/data/buff')
const SKILL_DIR = path.join(ROOT, 'src/data/skills/skillbooks')

/** 스킬북 로드 */
const skills = new Map()
for (const f of fs.readdirSync(SKILL_DIR)) {
  const j = JSON.parse(fs.readFileSync(path.join(SKILL_DIR, f), 'utf8'))
  for (const s of j.skills ?? []) skills.set(String(s.id), s)
}
const lvOf = (p) => Number(String(p.hs ?? '').replace(/^h/, '')) || 0
function propsAt(skill, lv) {
  const sorted = [...skill.levelProperties].sort((a, b) => lvOf(a) - lvOf(b))
  let r
  for (const p of sorted) {
    if (lvOf(p) <= lv) r = p
    else break
  }
  return r ?? sorted[0]
}

/**
 * 수동 규칙 — 효과 id별 기본값, 필요하면 버프 id별로 덮어쓴다.
 * 근거는 domain/attackPower.ts(숙련도) 및 각 스킬 툴팁(detail).
 */
const MANUAL = {
  // 숙련도: WZ mastery × 5 = 스킬이 주는 숙련도%. 실효 숙련도는 (10 + mastery)/100.
  mastery: { field: 'mastery', scale: 5 },
  // 부스터: WZ x가 "-2단계"처럼 음수로 들어있다
  attackSpeedBoost: { field: 'x', scale: -1 },
  castSpeedBoost: { field: 'x', scale: -1 },
  windBoostStep: { field: 'x', scale: -1 },
  // 위협: 적 물공/명중 감소량(%)과 받는 데미지 증가(%)
  monsterAttackReduceP: { field: 'pad' },
  monsterAccReduceP: { field: 'acc' },
  monsterDamageTakenP: { field: 'damage' },
  // 스탠스: WZ prop이 곧 넉백 방지 확률%
  stanceP: { field: 'prop' },
  // 엘리먼트 엠플리피케이션: WZ y가 "데미지 150%" 형태 → 증가분으로 환산
  amplifiedMagicDamageP: { field: 'y', offset: -100 },
  // 인레이지: WZ pad가 곧 추가 공격력
  addPad: { field: 'pad' },
  // 블로킹: WZ prop이 10배로 들어있다 (상류 SkillToolTipPostfix.blockingPostfix와 동일)
  blockRate: { field: 'prop', scale: 0.1 },
}
/** 버프 id별 예외 */
const MANUAL_BY_ID = {
  // 엑스퍼트는 마스터리(20렙 50%)와 합산되는 전제라 그만큼 뺀 증가분을 담는다
  3120005: { mastery: { field: 'mastery', scale: 5, offset: -50 } },
  3220004: { mastery: { field: 'mastery', scale: 5, offset: -50 } },
  13110003: { mastery: { field: 'mastery', scale: 5, offset: -50 } },
  // 아킬레스: WZ x는 "남는 데미지 995/1000" 형태 → 감소율%로 환산
  1120004: { damageReduce: { field: 'x', scale: -0.1, offset: 100 } },
  1220005: { damageReduce: { field: 'x', scale: -0.1, offset: 100 } },
  1320005: { damageReduce: { field: 'x', scale: -0.1, offset: 100 } },
}
/**
 * 파생하지 않고 값을 그대로 두는 효과 (스킬북에 근거가 없음).
 *  - 메소 가드 damageReduce: WZ x는 "메소로 방어하는 비율"이고 데미지 감소 50%는 인게임 고정값
 */
const KEEP_LITERAL = new Set(['4211005:damageReduce'])

/** 효과 id → 이름이 대응되는 WZ 필드 (자동 추론 우선순위) */
const PREFERRED_FIELD = {
  pad: 'pad',
  mad: 'mad',
  pdef: 'pdd',
  mdef: 'mdd',
  acc: 'acc',
  eva: 'eva',
  speed: 'speed',
  jump: 'jump',
  blockRate: 'prop',
  addEvadeP: 'prop',
  criticalP: 'prop',
  pad_energyCharge: 'pad',
}
/** 자동 추론에서 제외할 WZ 필드 (소비/지속/범위 등 효과와 무관) */
const IGNORE_FIELDS = new Set([
  'hs', 'time', 'lt', 'rb', 'cooltime', 'mobCount', 'mpCon', 'hpCon', 'bulletCount', 'attackCount',
])

const round3 = (n) => Math.round(n * 1000) / 1000
const applyRule = (raw, rule) => round3(Number(raw) * (rule.scale ?? 1) + (rule.offset ?? 0))

/** 규칙이 레벨 lv에서 만들어내는 값 (없으면 undefined — derive.ts와 같은 규칙: 0은 키 생략) */
function derivedAt(skill, lv, rule) {
  const raw = propsAt(skill, lv)?.[rule.field]
  if (raw === undefined) return undefined
  const v = applyRule(raw, rule)
  return v === 0 ? undefined : v
}

/**
 * 규칙이 현재 값을 전 레벨에서 그대로 재현하는지.
 * 0과 미기재는 같은 것으로 본다 — 기존 JSON이 저레벨 0을 적어둔 곳과 생략한 곳이 섞여 있고
 * (에너지 차지 5110001 vs 15100004), 합산 결과도 같다.
 */
function reproduces(skill, effects, effId, rule) {
  for (let lv = 1; lv <= effects.length; lv++) {
    const after = derivedAt(skill, lv, rule) ?? 0
    const cur = effects[lv - 1]?.[effId] ?? 0
    if (Math.abs(after - cur) > 1e-6) return false
  }
  return true
}

/** scale=1 + 상수 offset으로 설명되는 필드를 찾는다 */
function inferRule(skill, effects, effId) {
  const fields = [...new Set(skill.levelProperties.flatMap((p) => Object.keys(p)))].filter(
    (f) => !IGNORE_FIELDS.has(f),
  )
  const pref = PREFERRED_FIELD[effId]
  const order = [
    ...(pref && fields.includes(pref) ? [pref] : []),
    ...['x', 'y', 'damage', 'prop'].filter((f) => fields.includes(f) && f !== pref),
    ...fields.filter((f) => !['x', 'y', 'damage', 'prop'].includes(f) && f !== pref),
  ]
  for (const field of order) {
    // 양쪽 다 값이 있는 첫 레벨에서 offset을 뽑는다 (고레벨에만 붙는 능력치 대응)
    let offset
    for (let lv = 1; lv <= effects.length; lv++) {
      const raw = propsAt(skill, lv)?.[field]
      const cur = effects[lv - 1]?.[effId]
      if (raw === undefined || cur === undefined) continue
      offset = round3(cur - Number(raw))
      break
    }
    if (offset === undefined) continue
    const rule = offset === 0 ? { field } : { field, offset }
    if (reproduces(skill, effects, effId, rule)) return rule
  }
  return null
}

const files = []
for (const d of ['common', 'enhancement', 'jobSpecific']) {
  for (const f of fs.readdirSync(path.join(BUFF_DIR, d))) {
    if (f.endsWith('.json')) files.push(path.join(d, f))
  }
}

const migrated = []
const changed = []
const kept = []

for (const rel of files) {
  const abs = path.join(BUFF_DIR, rel)
  const list = JSON.parse(fs.readFileSync(abs, 'utf8'))
  if (!Array.isArray(list)) continue
  let touched = false

  for (const b of list) {
    if (!b.effectsByLevel) continue
    const skill = skills.get(String(b.id))
    if (!skill) {
      kept.push(`${b.id} ${b.name} — 스킬북에 없음`)
      continue
    }
    const keys = [...new Set(b.effectsByLevel.flatMap((e) => Object.keys(e)))]
    const derive = {}
    const literalKeys = []

    for (const effId of keys) {
      if (KEEP_LITERAL.has(`${b.id}:${effId}`)) {
        literalKeys.push(effId)
        continue
      }
      const manual = MANUAL_BY_ID[b.id]?.[effId] ?? MANUAL[effId]
      const rule = manual ?? inferRule(skill, b.effectsByLevel, effId)
      if (!rule) {
        literalKeys.push(effId)
        kept.push(`${b.id} ${b.name} — ${effId} 규칙 없음`)
        continue
      }
      // 값이 바뀌는지 확인해서 보고
      if (!reproduces(skill, b.effectsByLevel, effId, rule)) {
        const diffs = []
        for (let lv = 1; lv <= b.effectsByLevel.length; lv++) {
          const raw = propsAt(skill, lv)?.[rule.field]
          const before = b.effectsByLevel[lv - 1]?.[effId]
          const after = raw === undefined ? undefined : applyRule(raw, rule)
          if ((before ?? 0) !== (after ?? 0)) diffs.push(`${lv}:${before}→${after}`)
        }
        changed.push(
          `${b.id} ${b.name} [${rel}] ${effId} ← ${rule.field}` +
            `${rule.scale ? `×${rule.scale}` : ''}${rule.offset ? (rule.offset > 0 ? `+${rule.offset}` : rule.offset) : ''}` +
            `\n      ${diffs.length}개 레벨 변경: ${diffs.join(' ')}`,
        )
      }
      derive[effId] = rule
    }

    if (!Object.keys(derive).length) continue

    // 파생으로 옮긴 키는 effectsByLevel에서 제거, 남은 키만 유지
    const rest = b.effectsByLevel.map((e) =>
      Object.fromEntries(Object.entries(e).filter(([k]) => literalKeys.includes(k))),
    )
    b.derive = derive
    if (rest.some((e) => Object.keys(e).length)) b.effectsByLevel = rest
    else delete b.effectsByLevel
    migrated.push(`${b.id} ${b.name}`)
    touched = true
  }

  if (touched && WRITE) fs.writeFileSync(abs, JSON.stringify(list, null, 2) + '\n')
}

console.log(`파생 전환 ${migrated.length}건 / 값 그대로 둔 항목 ${kept.length}건`)
console.log(`\n=== 값이 바뀌는 항목 (${changed.length}건) ===`)
console.log(changed.join('\n') || '(없음)')
console.log(`\n=== 파생하지 않고 남긴 것 ===`)
console.log([...new Set(kept)].join('\n'))
console.log(WRITE ? '\n(파일을 덮어썼다)' : '\n(드라이런 — --write 를 붙여야 실제로 쓴다)')
