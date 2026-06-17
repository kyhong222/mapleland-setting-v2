/**
 * 스킬 버프/패시브 데이터 생성기.
 *
 * 출처: github.com/kyhong222/ms-skill-simulator (src/data/skillbooks/<code>.json)
 * 각 스킬의 levelProperties(원시 게임 속성)를 우리 EffectMap으로 변환한다.
 *
 * 원시 속성 키 의미가 스킬마다 다르므로(예: x = 올스탯% / 피격배율 / 명중 …),
 * 아래 SKILL_MAP에 스킬별 derive(레벨속성 → EffectMap)를 명시한다.
 * SKILL_MAP에 없는 스킬은 제외(공격스킬·유틸·의미불명 등).
 *
 * 출력:
 *   src/data/buff/common/skills.json       (메이플 용사 등 공용)
 *   src/data/buff/enhancement/party.json   (파티 버프)
 *   src/data/buff/jobSpecific/skills.json   (개인 패시브/버프, jobs[] 포함)
 *
 * 실행: node scripts/buildBuffs.mjs
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(__dirname, '..', 'src', 'data', 'buff')
const RAW = 'https://raw.githubusercontent.com/kyhong222/ms-skill-simulator/main/src/data/skillbooks'

// 레포 4차(최종) 직업코드 → 우리 JobId
const FINAL_TO_JOBID = {
  112: 'hero', 122: 'paladin', 132: 'darkKnight',
  212: 'archMageFP', 222: 'archMageIL', 232: 'bishop',
  312: 'bowmaster', 322: 'marksman',
  412: 'nightLord', 422: 'shadower',
  512: 'viper', 522: 'captain',
}

// 최종직업 → 전직 체인(스킬북 코드들). (레포 jobs.ts subJobs 모험가 부분)
const SUB_JOBS = {
  112: [100, 110, 111, 112], 122: [100, 120, 121, 122], 132: [100, 130, 131, 132],
  212: [200, 210, 211, 212], 222: [200, 220, 221, 222], 232: [200, 230, 231, 232],
  312: [300, 310, 311, 312], 322: [300, 320, 321, 322],
  412: [400, 410, 411, 412], 422: [400, 420, 421, 422],
  512: [500, 510, 511, 512], 522: [500, 520, 521, 522],
}

const ALL_BOOKS = [...new Set(Object.values(SUB_JOBS).flat())].sort((a, b) => a - b)

const n = (p, k) => (k in p ? Number(p[k]) : 0)

// 스킬북에 없는 특수/수동 버프 (공용)
const MANUAL_COMMON = [
  {
    id: 'echoOfHero',
    type: 'skill',
    name: '영웅의 메아리',
    scope: 'party',
    mode: 'active',
    masterLevel: 1,
    effectsByLevel: [{ padP: 4, madP: 4 }],
  },
]

// scope: 'party'(전 직업, 이름으로 dedup) | 'personal'(직업별, jobs 계산)
// dir: 'common' | 'enhancement' | 'jobSpecific'
// mode: 'active' | 'passive'
// derive(p): 레벨속성 → EffectMap
const SKILL_MAP = {
  // ── 공용(party·common) ─────────────────────────────
  // 메이플 용사: x = 올스탯%
  1121000: mw(), 1221000: mw(), 1321000: mw(), 2121000: mw(), 2221000: mw(),
  2321000: mw(), 3121000: mw(), 3221000: mw(), 4121000: mw(), 4221000: mw(),
  5121000: mw(), 5221000: mw(),

  // ── 파티 버프(party·enhancement) ──────────────────
  // 샤프 아이즈: x = 크리티컬 확률%, y = 크리티컬 데미지(y-100)%
  3121002: { name: '샤프 아이즈', scope: 'party', dir: 'enhancement', mode: 'active', derive: p => ({ criticalP: n(p, 'x'), criticalDamage: n(p, 'y') - 100 }) },
  3221002: { name: '샤프 아이즈', scope: 'party', dir: 'enhancement', mode: 'active', derive: p => ({ criticalP: n(p, 'x'), criticalDamage: n(p, 'y') - 100 }) },
  // 하이퍼 바디: x = HP%, y = MP%
  1301007: { name: '하이퍼 바디', scope: 'party', dir: 'enhancement', mode: 'active', derive: p => ({ hpP: n(p, 'x'), mpP: n(p, 'y') }) },
  // 블레스: 명중/회피/물마방
  2301004: { name: '블레스', scope: 'party', dir: 'enhancement', mode: 'active', derive: p => ({ acc: n(p, 'acc'), eva: n(p, 'eva'), pdef: n(p, 'pdd'), mdef: n(p, 'mdd') }) },
  // 헤이스트: 이속/점프
  4101004: { name: '헤이스트', scope: 'party', dir: 'enhancement', mode: 'active', derive: p => ({ speed: n(p, 'speed'), jump: n(p, 'jump') }) },
  4201003: { name: '헤이스트', scope: 'party', dir: 'enhancement', mode: 'active', derive: p => ({ speed: n(p, 'speed'), jump: n(p, 'jump') }) },
  // 메디테이션: 마력
  2101001: { name: '메디테이션', scope: 'party', dir: 'enhancement', mode: 'active', derive: p => ({ mad: n(p, 'mad') }) },
  2201001: { name: '메디테이션', scope: 'party', dir: 'enhancement', mode: 'active', derive: p => ({ mad: n(p, 'mad') }) },
  // 분노: 물공+, 물방− (파티버프)
  1101006: { name: '분노', scope: 'party', dir: 'enhancement', mode: 'active', derive: p => ({ pad: n(p, 'pad'), pdef: n(p, 'pdd') }) },
  // 아이언 월: 물·마방 (파티버프)
  1301006: { name: '아이언 월', scope: 'party', dir: 'enhancement', mode: 'active', derive: p => ({ pdef: n(p, 'pdd'), mdef: n(p, 'mdd') }) },

  // ── 개인 패시브/버프(personal·jobSpecific) ────────
  // 전사
  1001003: pPassive('아이언 바디', p => ({ pdef: n(p, 'pdd') })),
  // 인레이지: 개인버프(향후 파티 전환 예정)
  1121010: pActive('인레이지', p => ({ pad: n(p, 'pad') })),
  1120004: pPassive('아킬레스', achilles), 1220005: pPassive('아킬레스', achilles), 1320005: pPassive('아킬레스', achilles),
  1121002: pActive('스탠스', stance), 1221002: pActive('스탠스', stance), 1321002: pActive('스탠스', stance),
  // 블로킹: 마스터 시 15% (prop/10)
  1120005: pActive('블로킹', block), 1220006: pActive('블로킹', block),
  1311008: pActive('드래곤 블러드', p => ({ pad: n(p, 'pad') })),
  1310000: pPassive('엘리먼트 레지스턴스', p => ({ allRes: n(p, 'x') })),
  // 비홀더스 버프: 여러 효과 동시 제공(명중/회피/공격/물·마방)
  1320009: pActive('비홀더스 버프', p => ({ acc: n(p, 'acc'), eva: n(p, 'eva'), pad: n(p, 'pad'), pdef: n(p, 'pdd'), mdef: n(p, 'mdd') })),
  // 비홀더: 무기 숙련도 제공(필드×5 → 최대 20%)
  1321007: pPassive('비홀더', p => ({ mastery: n(p, 'mastery') * 5 })),

  // 마법사
  2001003: pActive('매직 아머', p => ({ pdef: n(p, 'pdd') })),
  // 엘멤: x=소비MP증가(제외), y=공격마법데미지증가%
  2110001: pPassive('엘리먼트 엠플리피케이션', p => ({ amplifiedMagicDamageP: n(p, 'y') - 100 })),
  2210001: pPassive('엘리먼트 엠플리피케이션', p => ({ amplifiedMagicDamageP: n(p, 'y') - 100 })),
  2310000: pPassive('엘리먼트 레지스턴스', p => ({ allRes: n(p, 'x') })),
  // 파셜 레지스턴스: 불독→화염/독, 썬콜→냉기/번개 저항
  2110000: pPassive('파셜 레지스턴스', p => ({ fireRes: n(p, 'x'), poisonRes: n(p, 'x') })),
  2210000: pPassive('파셜 레지스턴스', p => ({ coldRes: n(p, 'x'), lightningRes: n(p, 'x') })),

  // 궁수
  3000000: pPassive('아마존의 축복', p => ({ acc: n(p, 'x') })),
  3000001: pPassive('크리티컬 샷', crit),
  3001003: pActive('포커스', p => ({ acc: n(p, 'acc'), eva: n(p, 'eva') })),
  3110000: pPassive('쓰러스트', p => ({ speed: n(p, 'speed') })),
  3210000: pPassive('쓰러스트', p => ({ speed: n(p, 'speed') })),
  3121008: pActive('집중', p => ({ pad: n(p, 'pad') })),

  // 도적
  4000000: pPassive('님블 바디', p => ({ acc: n(p, 'x'), eva: n(p, 'y') })),
  4100001: pPassive('크리티컬 스로우', crit),
  // 페이크: 추가 회피확률%(나로/섀도어 수치 다름)
  4120002: pActive('페이크', p => ({ addEvadeP: n(p, 'prop') })),
  4220002: pActive('페이크', p => ({ addEvadeP: n(p, 'prop') })),
  // 메소 가드: 피격 데미지 50% 감소(전 레벨 고정, x는 메소 환산비라 미사용)
  4211005: pActive('메소 가드', () => ({ damageReduce: 50 })),

  // 해적
  5000000: pPassive('퀵모션', p => ({ acc: n(p, 'x'), eva: n(p, 'y') })),
  5111005: pActive('트랜스폼', transform),
  5121003: pActive('슈퍼 트랜스폼', transform),

  // 쉴드 마스터리: 방패 방어력 보너스%(히어로/팔라딘/섀도어). x=105~200 → (x−100)%
  1110001: pPassive('쉴드 마스터리', shieldM),
  1210001: pPassive('쉴드 마스터리', shieldM),
  4210000: pPassive('쉴드 마스터리', shieldM),

  // ── 무기 마스터리(2차, 패시브) ─ 숙련도 = 필드×5, 명중률 = x ──
  1100000: mastery2('소드 마스터리'), 1100001: mastery2('엑스 마스터리'),
  1200000: mastery2('소드 마스터리'), 1200001: mastery2('메이스 마스터리'),
  1300000: mastery2('스피어 마스터리'), 1300001: mastery2('폴암 마스터리'),
  3100000: mastery2('보우 마스터리'),
  3200000: mastery2('크로스보우 마스터리'),
  4100000: mastery2('자벨린 마스터리'),
  4200000: mastery2('대거 마스터리'),
  5100001: mastery2('너클 마스터리'),
  5200000: mastery2('건 마스터리'),

  // ── 엑스퍼트(4차, 패시브) ─ 마스터리 위 추가 기여분 = 필드×5−50, 물리공격력 = x ──
  3120005: expert('보우 엑스퍼트'),
  3220004: expert('크로스보우 엑스퍼트'),
}

function mw() {
  return { name: '메이플 용사', scope: 'party', dir: 'common', mode: 'active', derive: p => ({ allStatP: n(p, 'x') }) }
}
function achilles(p) { return { damageReduce: (1000 - n(p, 'x')) / 10 } }
function stance(p) { return { stanceP: n(p, 'prop') } }
function block(p) { return { blockRate: n(p, 'prop') / 10 } }
function shieldM(p) { return { shieldBonusPdef: n(p, 'x') - 100 } }
// 크리티컬 샷/스로우: 크리티컬 확률 = prop, 크리티컬 데미지 = damage − 100
function crit(p) { return { criticalP: n(p, 'prop'), criticalDamage: n(p, 'damage') - 100 } }
// 트랜스폼: STR/물·마방만(speed40·jump20은 변신폼 고정값이라 제외)
function transform(p) { return { STR: n(p, 'str'), pdef: n(p, 'pdd'), mdef: n(p, 'mdd') } }
function pPassive(name, derive) { return { name, scope: 'personal', dir: 'jobSpecific', mode: 'passive', derive } }
function pActive(name, derive) { return { name, scope: 'personal', dir: 'jobSpecific', mode: 'active', derive } }
// 2차 무기 마스터리: 숙련도% = mastery×5, 명중 = x (자벨린/건의 y=표창·불릿수는 제외)
function mastery2(name) { return pPassive(name, p => ({ mastery: n(p, 'mastery') * 5, acc: n(p, 'x') })) }
// 4차 엑스퍼트: 마스터리(50%) 위 추가 기여분 = mastery×5−50, 물리공격력 = x
function expert(name) { return pPassive(name, p => ({ mastery: n(p, 'mastery') * 5 - 50, pad: n(p, 'x') })) }

// 0만 있는 EffectMap 항목 제거(레벨에 따라 일부 키만 의미있는 경우 보존 위해 전체 0 키만 정리)
function cleanEffects(eff) {
  const out = {}
  for (const [k, v] of Object.entries(eff)) if (v !== 0 && !Number.isNaN(v)) out[k] = v
  return out
}

async function fetchBook(code) {
  const res = await fetch(`${RAW}/${code}.json`)
  if (!res.ok) throw new Error(`fetch ${code} failed: ${res.status}`)
  return res.json()
}

// 개인스킬: 이 스킬북(code)을 쓰는 최종직업들의 JobId
function jobsForBook(code) {
  const ids = []
  for (const [final, chain] of Object.entries(SUB_JOBS)) {
    if (chain.includes(code)) ids.push(FINAL_TO_JOBID[final])
  }
  return ids
}

// hs("h10") → 레벨 숫자
const hsLevel = (e) => Number(String(e.hs || '').replace(/\D/g, '')) || 0

function buildSkill(skill, def, code) {
  const lp = [...(skill.levelProperties || [])].sort((a, b) => hsLevel(a) - hsLevel(b))
  const effectsByLevel = lp.map(def.derive).map(cleanEffects)
  const out = {
    id: String(skill.id),
    type: 'skill',
    name: def.name,
    scope: def.scope,
    mode: def.mode,
    masterLevel: skill.masterLevel,
    effectsByLevel,
  }
  if (def.scope === 'personal') out.jobs = jobsForBook(code)
  return out
}

const main = async () => {
  const common = []
  const party = []
  const jobSpecific = []
  const seenPartyName = new Set()

  for (const code of ALL_BOOKS) {
    const book = await fetchBook(code)
    for (const skill of book.skills) {
      const def = SKILL_MAP[skill.id]
      if (!def) continue
      if (def.scope === 'party') {
        if (seenPartyName.has(def.name)) continue
        seenPartyName.add(def.name)
        const built = buildSkill(skill, def, code)
        if (def.dir === 'common') common.push(built)
        else party.push(built)
      } else {
        jobSpecific.push(buildSkill(skill, def, code))
      }
    }
  }

  const write = (dir, file, data) => {
    const d = path.join(OUT, dir)
    fs.mkdirSync(d, { recursive: true })
    fs.writeFileSync(path.join(d, file), JSON.stringify(data, null, 2) + '\n')
    console.log(`  ${dir}/${file}: ${data.length}`)
  }
  common.push(...MANUAL_COMMON)
  console.log('generated:')
  write('common', 'skills.json', common)
  write('enhancement', 'party.json', party)
  write('jobSpecific', 'skills.json', jobSpecific)
}

main().catch((e) => { console.error(e); process.exit(1) })
