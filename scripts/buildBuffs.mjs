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
 *   src/data/buff/common/skills.json        (메이플 용사 등 공용)
 *   src/data/buff/enhancement/party.json    (파티 버프)
 *   src/data/buff/enhancement/personal.json (개인특화 액티브)
 *   src/data/buff/jobSpecific/skills.json   (개인 패시브/버프, jobs[] 포함)
 *
 * 실행:
 *   node scripts/buildBuffs.mjs           → 드라이런(비교만, 파일 안 씀)
 *   node scripts/buildBuffs.mjs --write   → 실제 덮어쓰기
 *
 * ⚠ 이 생성기는 최초 부트스트랩 이후 손으로 관리해온 JSON을 따라오지 못한다.
 * 2026-08-14 기준 그대로 --write 하면 아래가 유실된다:
 *   - SKILL_MAP에 정의 없는 45건 (부스터 전종, 시그너스 5직업 전부,
 *     어드밴스드 차지, 매직 가드, 에너지 차지, 스턴 마스터리 등)
 *   - SUB_JOBS에 시그너스(1100~1511)가 없어 해당 스킬북을 읽지도 않음
 *   - requires / requiresShield / variants 필드 (buildSkill 미출력)
 *   - 아이콘 108개: 현재 JSON은 /skill-icons/*.png 로컬 경로인데 여기선 base64를 넣음
 *   - jobSpecific/damageBuffs.json(콤보·버서크)은 생성 대상 자체가 아님
 * 그래서 기본 동작을 드라이런으로 두고, 무엇이 사라지는지 먼저 출력한다.
 * 다시 생성기 기반으로 돌리려면 위 항목부터 SKILL_MAP에 채워야 한다.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(__dirname, '..', 'src', 'data', 'buff')
const RAW = 'https://raw.githubusercontent.com/kyhong222/ms-skill-simulator/main/src/data/skillbooks'
const WRITE = process.argv.includes('--write')

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
    icon: "https://static.wikia.nocookie.net/maplestory/images/3/35/Skill_Hero%27s_Echo.png/revision/latest?cb=20100111124253",
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
  // 인레이지: 파티버프. 스펙 변경 → 추가공격력(addPad), 전 구간 -10 (Lv1=1 ... 마스터=16)
  1121010: { name: '인레이지', scope: 'party', dir: 'enhancement', mode: 'active', derive: p => ({ addPad: n(p, 'pad') - 10 }) },

  // ── 개인 패시브/버프(personal·jobSpecific) ────────
  // 전사
  1001003: pActive('아이언 바디', p => ({ pdef: n(p, 'pdd') })),
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
  // 파워 가드: 피해 반사%(파이터/페이지 → 히어로/팔라딘)
  1101007: pActive('파워 가드', p => ({ damageReflectP: n(p, 'x') })),
  1201007: pActive('파워 가드', p => ({ damageReflectP: n(p, 'x') })),

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
  // 스턴 마스터리: 스턴 상태 적 공격 시 크리 발동 — 유도식은 크리티컬 샷/스로우와 동일.
  // 상황 의존이라 켤 때 스턴 상태를 가정한다는 뜻으로 note를 단다.
  5110000: { ...pPassive('스턴 마스터리', crit), note: '스턴 상황 가정' },
  // 변신은 특화 버프 토글(passive)로 둬야 exclusiveGroup 배타가 걸린다.
  // 트폼↔슈트폼만 상호배타 — 에너지 차지는 변신과 완전히 독립이라 그룹에 넣지 않는다.
  5111005: { ...pPassive('트랜스폼', transform), exclusiveGroup: 'pirateForm' },
  5121003: { ...pPassive('슈퍼 트랜스폼', transform), exclusiveGroup: 'pirateForm' },

  // 쉴드 마스터리: 방패 방어력 보너스%(히어로/팔라딘/섀도어). x=105~200 → (x−100)%
  1110001: pPassive('쉴드 마스터리', shieldM),
  1210001: pPassive('쉴드 마스터리', shieldM),
  4210000: pPassive('쉴드 마스터리', shieldM),

  // ── 무기 마스터리(2차, 패시브) ─ 숙련도 = 필드×5, 명중률 = x · 장착 주무기로 자동 게이팅 ──
  1100000: mastery2('소드 마스터리', ['oneHandedSword', 'twoHandedSword']),
  1100001: mastery2('엑스 마스터리', ['oneHandedAxe', 'twoHandedAxe']),
  1200000: mastery2('소드 마스터리', ['oneHandedSword', 'twoHandedSword']),
  1200001: mastery2('메이스 마스터리', ['oneHandedMace', 'twoHandedMace']),
  1300000: mastery2('스피어 마스터리', ['spear']),
  1300001: mastery2('폴암 마스터리', ['polearm']),
  3100000: mastery2('보우 마스터리', ['bow']),
  3200000: mastery2('크로스보우 마스터리', ['crossbow']),
  4100000: mastery2('자벨린 마스터리', ['claw']),
  4200000: mastery2('대거 마스터리', ['dagger']),
  5100001: mastery2('너클 마스터리', ['knuckle']),
  5200000: mastery2('건 마스터리', ['gun']),

  // ── 엑스퍼트(4차, 패시브) ─ 마스터리 위 추가 기여분 = 필드×5−50, 물리공격력 = x ──
  3120005: expert('보우 엑스퍼트', ['bow']),
  3220004: expert('크로스보우 엑스퍼트', ['crossbow']),
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
// 트랜스폼: 물·마방만.
//  - WZ 레벨속성에 str(20렙 기준 트폼 20/슈트폼 30)이 있지만 인게임에는 반영되지 않는다
//    (2026-08-14 실측 확인). 데이터에 있다고 다시 넣지 말 것.
//  - speed 40 / jump 20은 전 레벨 고정값이라 증가치가 아닌 변신폼 고정 수치 → 제외.
function transform(p) { return { pdef: n(p, 'pdd'), mdef: n(p, 'mdd') } }
function pPassive(name, derive) { return { name, scope: 'personal', dir: 'jobSpecific', mode: 'passive', derive } }
function pActive(name, derive) { return { name, scope: 'personal', dir: 'jobSpecific', mode: 'active', derive } }
// 2차 무기 마스터리: 숙련도% = mastery×5, 명중 = x (자벨린/건의 y=표창·불릿수는 제외)
function mastery2(name, weaponTypes) { return { ...pPassive(name, p => ({ mastery: n(p, 'mastery') * 5, acc: n(p, 'x') })), weaponTypes } }
// 4차 엑스퍼트: 마스터리(50%) 위 추가 기여분 = mastery×5−50, 물리공격력 = x
function expert(name, weaponTypes) { return { ...pPassive(name, p => ({ mastery: n(p, 'mastery') * 5 - 50, pad: n(p, 'x') })), weaponTypes } }

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
  if (skill.icon) out.icon = `data:image/png;base64,${skill.icon}`
  if (def.scope === 'personal') out.jobs = jobsForBook(code)
  if (def.weaponTypes) out.weaponTypes = def.weaponTypes
  if (def.exclusiveGroup) out.exclusiveGroup = def.exclusiveGroup
  if (def.note) out.note = def.note
  return out
}

const main = async () => {
  const common = []
  const party = []
  const personal = [] // 개인특화 액티브
  const jobSpecific = [] // 개인특화 패시브
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
        const built = buildSkill(skill, def, code)
        ;(def.mode === 'active' ? personal : jobSpecific).push(built)
      }
    }
  }

  // 기존 파일과 비교해 유실될 항목을 먼저 보고한다. --write 없으면 쓰지 않는다.
  let lost = 0
  const write = (dir, file, data) => {
    const p = path.join(OUT, dir, file)
    const prev = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : []
    const nextIds = new Set(data.map((b) => b.id))
    const dropped = prev.filter((b) => !nextIds.has(b.id))
    lost += dropped.length
    console.log(`  ${dir}/${file}: ${prev.length} → ${data.length}${dropped.length ? `  유실 ${dropped.length}건` : ''}`)
    for (const b of dropped) console.log(`      - ${b.id} ${b.name}`)
    if (!WRITE) return
    fs.mkdirSync(path.join(OUT, dir), { recursive: true })
    fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n')
  }
  common.push(...MANUAL_COMMON)
  console.log(WRITE ? 'writing:' : 'dry-run (파일 안 씀 — 반영하려면 --write):')
  write('common', 'skills.json', common)
  write('enhancement', 'party.json', party)
  write('enhancement', 'personal.json', personal)
  write('jobSpecific', 'skills.json', jobSpecific)
  if (lost) {
    console.log(`\n총 ${lost}건이 유실된다. SKILL_MAP에 정의를 채우기 전에는 --write 하지 말 것.`)
    console.log('(requires/requiresShield/variants 필드와 /skill-icons 경로도 함께 사라진다)')
  }
  if (!WRITE) console.log('\n덮어쓰려면: node scripts/buildBuffs.mjs --write')
}

main().catch((e) => { console.error(e); process.exit(1) })
