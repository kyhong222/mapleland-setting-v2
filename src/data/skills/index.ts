/**
 * 스킬 데이터 접근자 (ms-skill-simulator 포트).
 *
 * 스킬북은 전직 차수별(예: 파이터110/크루세이더111/히어로112)이라, v2 직업 1개는
 * 1~4차(시그너스는 1~3차) 스킬북을 합산해 구성한다.
 *
 * 아직 UI/데미지 계산과 연동하지 않은 순수 데이터 레이어다.
 */

import type { JobId } from '../../domain/jobs'
import type { IJobSkill, IJobSkillBook, ILevelProperties } from './types'
import { SKILLBOOKS } from './books.generated'

export type { IJobSkill, IJobSkillBook, ILevelProperties, IJob } from './types'
export { SKILLBOOKS } from './books.generated'

/** v2 직업 → 스킬북 코드(전직 차수 체인) */
export const JOB_SKILLBOOKS: Record<JobId, number[]> = {
  // 전사
  hero: [100, 110, 111, 112],
  paladin: [100, 120, 121, 122],
  darkKnight: [100, 130, 131, 132],
  // 마법사
  archMageFP: [200, 210, 211, 212],
  archMageIL: [200, 220, 221, 222],
  bishop: [200, 230, 231, 232],
  // 궁수
  bowmaster: [300, 310, 311, 312],
  marksman: [300, 320, 321, 322],
  // 도적
  nightLord: [400, 410, 411, 412],
  shadower: [400, 420, 421, 422],
  // 해적
  viper: [500, 510, 511, 512],
  captain: [500, 520, 521, 522],
  // 시그너스 기사단 (1~3차)
  soulMaster: [1100, 1110, 1111],
  flameWizard: [1200, 1210, 1211],
  windBreaker: [1300, 1310, 1311],
  nightWalker: [1400, 1410, 1411],
  striker: [1500, 1510, 1511],
}

/** 스킬북 단건 조회 */
export function getSkillbook(code: number): IJobSkillBook | undefined {
  return SKILLBOOKS[code]
}

/** 직업의 스킬북 목록(차수 순) */
export function skillbooksForJob(jobId: JobId): IJobSkillBook[] {
  return (JOB_SKILLBOOKS[jobId] ?? []).map((c) => SKILLBOOKS[c]).filter((b): b is IJobSkillBook => !!b)
}

/** 직업의 전체 스킬 목록(차수 합산) */
export function skillsForJob(jobId: JobId): IJobSkill[] {
  return skillbooksForJob(jobId).flatMap((b) => b.skills)
}

/** levelProperties의 레벨 파싱 (hs "h10" → 10) */
export function levelOfProps(p: ILevelProperties): number {
  return Number(p.hs?.replace(/^h/, '')) || 0
}

/** 특정 레벨의 속성 (해당 레벨 이하 최댓값; 없으면 최저 레벨) */
export function skillPropsAtLevel(skill: IJobSkill, level: number): ILevelProperties | undefined {
  const sorted = [...skill.levelProperties].sort((a, b) => levelOfProps(a) - levelOfProps(b))
  let result: ILevelProperties | undefined
  for (const p of sorted) {
    if (levelOfProps(p) <= level) result = p
    else break
  }
  return result ?? sorted[0]
}

/** 속성값을 숫자로 (없으면 0) */
export function skillNum(props: ILevelProperties | undefined, key: string): number {
  const v = props?.[key]
  return v === undefined ? 0 : Number(v) || 0
}

/** 소환수 스킬 — 데미지 지원 대상에서 제외 (물리 소환수는 mad/damage가 없어 자동 제외됨) */
const SUMMON_SKILLS = new Set(['이프리트', '엘퀴네스', '바하뮤트', '서먼 드래곤'])

/**
 * 데미지 증가 버프(콤보/어드밴스드콤보/버서크) — damage 필드를 갖지만 공격 스킬이 아님.
 * (특화/파티 버프로 관리되므로 데미지 계산 스킬 목록에서 제외)
 */
const DAMAGE_BUFF_SKILLS = new Set([1111002, 1120003, 11111001, 11110005, 1320006])

/**
 * 공격 스킬에서 제외할 비공격/디버프/패시브 스킬명.
 *  - 크리티컬 스로우/샷/펀치 = 크리 패시브
 *  - 모탈 블로우(보마 3110001 / 신궁 3210001) = 근접 시 확률 발동 패시브.
 *    damage 필드를 갖지만 직접 시전하는 스킬이 아니라 데미지 계산 대상이 아니다.
 *    특화 버프로도 다루지 않는다(발동 조건이 상황 의존).
 *  - 스턴 마스터리(바이퍼 5110000) = 스턴 상태 적 공격 시 크리 패시브.
 *    특화 버프에서 '스턴 상황 가정'으로 켜면 크리 확률/데미지로 반영된다.
 */
const NON_ATTACK_NAMES = new Set(['메디테이션', '매직 크래쉬', '크리티컬 스로우', '크리티컬 샷', '크리티컬 펀치', '모탈 블로우', '스턴 마스터리'])

/** 공격 스킬 여부 (물리 damage 또는 마법 mad 보유; 차지/메디테이션/소환수/파이널어택/데미지버프 제외) */
export function isAttackSkill(skill: IJobSkill): boolean {
  const name = skill.description?.name ?? ''
  // 속성 차지·어드밴스드 차지는 특화버프로 관리 → 제외. 단 '차지 블로우'는 공격 스킬로 유지
  const isCharge = name.includes('차지') && !name.includes('블로우')
  if (isCharge || name.includes('파이널 어택') || NON_ATTACK_NAMES.has(name) || SUMMON_SKILLS.has(name)) return false
  if (DAMAGE_BUFF_SKILLS.has(skill.id)) return false
  return skill.levelProperties.some((p) => p.mad !== undefined || p.damage !== undefined)
}

/** 직업의 공격 스킬 목록 */
export function attackSkillsForJob(jobId: JobId): IJobSkill[] {
  return skillsForJob(jobId).filter(isAttackSkill)
}

export interface SkillAttack {
  kind: 'physical' | 'magic'
  /** 물리 스킬 배율%(마법은 100) */
  skillPercent: number
  /** 마법 Spell Attack(mad) */
  spellAtk: number
  /** 속성 코드(F/I/L/S/H) — 무속성이면 undefined */
  element?: string
  /** 마법 숙련도(0~1). 물리는 undefined — 무기 마스터리 스킬에서 오므로 masteryRatio가 담당 */
  mastery?: number
}

/** 마법 기본 숙련도(%) — 스킬 숙련도에 항상 합산된다 */
export const MAGIC_BASE_MASTERY = 10

/**
 * 마법 궁극기(제네시스·메테오·블리자드)의 숙련도(%) — 고정 60.
 * 이 셋만 WZ에 mastery 필드가 없고 툴팁에도 '숙련도' 줄이 없다(다른 마법 공격 스킬의
 * detail은 "…기본 공격력 #mad, 숙련도 #mastery%"). 인게임 확인값으로 고정한다.
 */
export const MAGIC_NO_MASTERY_DEFAULT = 60

/**
 * 마법 공격 스킬의 숙련도(0~1).
 *
 * 원작은 기본 숙련도 10%에 스킬 숙련도를 더한다. 스킬 숙련도 = WZ mastery 값 × 5%
 * (소드 마스터리 20레벨의 mastery가 10인데 인게임 표기는 50%인 것으로 배율 검증).
 *   - 엔젤레이/샤이닝 레이/홀리 에로우 마스터: mastery 10 → 10 + 50 = 60%
 *   - 빅뱅 마스터: mastery 14 → 10 + 70 = 80%
 *   - 제네시스/메테오/블리자드: mastery 없음 → 60% 고정
 *
 * 물리는 스킬이 아니라 무기 마스터리 스킬에서 오므로 여기서 다루지 않는다.
 */
export function magicMasteryRatio(props: ILevelProperties | undefined): number {
  const raw = skillNum(props, 'mastery')
  const pct = raw > 0 ? MAGIC_BASE_MASTERY + raw * 5 : MAGIC_NO_MASTERY_DEFAULT
  return Math.min(1, pct / 100)
}

/**
 * 소스 데이터에 elementalAttribute가 누락된 스킬의 속성 보완 (이름 → 속성코드).
 * 주로 FP(불독)계 화염 마법이 소스에 속성이 비어 있어 채운다.
 */
const SKILL_ELEMENT_OVERRIDE: Record<string, string> = {
  '파이어 에로우': 'F',
  '파이어 스트라이크': 'F',
  '파이어 필라': 'F',
  '플레임': 'F',
  '플레임 기어': 'F',
  '메테오': 'F',
}

/**
 * 두 속성을 동시에 띠는 스킬 (원작은 데미지를 반씩 나눠 각 속성으로 판정한다).
 * 매직 컴포지션: 불독 = 불+독, 썬콜 = 얼음+번개.
 */
export const MULTI_ELEMENT_SKILLS: Record<number, string[]> = {
  2111006: ['F', 'S'],
  2211006: ['I', 'L'],
}

/** 스킬이 띠는 속성코드 목록 (무속성이면 빈 배열). 복합속성 스킬은 2개 */
export function skillElements(skill: IJobSkill, level: number): string[] {
  const multi = MULTI_ELEMENT_SKILLS[skill.id]
  if (multi) return multi
  const att = skillAttackAt(skill, level)
  return att?.element ? [att.element] : []
}

/** id로 스킬 검색 (전 스킬북) */
export function findSkillById(id: number): IJobSkill | undefined {
  for (const book of Object.values(SKILLBOOKS) as IJobSkillBook[]) {
    const s = book.skills.find((sk) => sk.id === id)
    if (s) return s
  }
  return undefined
}

/**
 * 콤보 어택 최종데미지증가%(finalDamageP). docs §4.
 *  maxCounter = 어드밴스드 학습 ? advCombo.x : combo.x
 *  c≤5: combo.damage + (c−1)×(comboLv/6)   /  c≥6: advCombo.damage + 20 + (c−5)×4
 *  finalDamageP = 뎀증% − 100
 */
export function comboFinalDamageP(comboId: number, comboLevel: number, advId: number, advLevel: number): number {
  const combo = findSkillById(comboId)
  if (!combo || comboLevel <= 0) return 0
  const cProps = skillPropsAtLevel(combo, comboLevel)
  const comboDmg = skillNum(cProps, 'damage')
  const comboX = skillNum(cProps, 'x')

  const adv = advLevel > 0 ? findSkillById(advId) : undefined
  let pct: number
  if (adv) {
    const aProps = skillPropsAtLevel(adv, advLevel)
    const advDmg = skillNum(aProps, 'damage')
    const maxCounter = skillNum(aProps, 'x')
    pct = advDmg + 20 + Math.max(0, maxCounter - 5) * 4
  } else {
    const maxCounter = comboX
    pct = comboDmg + (maxCounter - 1) * (comboLevel / 6)
  }
  return Math.max(0, pct - 100)
}

/** 특정 스킬의 레벨별 임의 필드 숫자값 (없으면 0). 소울차지 계수·엘리멘탈리셋 무속성화% 등 */
export function skillNumAt(id: number, level: number, key: string): number {
  const sk = findSkillById(id)
  return sk ? skillNum(skillPropsAtLevel(sk, level), key) : 0
}

/** 팔라딘 차지 원소 → 차지 스킬 id(검 대표) */
const CHARGE_SKILL_ID: Record<string, number> = { fire: 1211003, ice: 1211005, lightning: 1211007, holy: 1221003 }

/** 차지의 레벨별 데미지 계수%(damage 필드). 파이어 lv30=140, 아이스=110, 썬더=125, 홀리 lv20=150 */
export function chargeDamagePercent(element: string, level: number): number {
  const id = CHARGE_SKILL_ID[element]
  const sk = id ? findSkillById(id) : undefined
  return sk ? skillNum(skillPropsAtLevel(sk, level), 'damage') : 0
}

/**
 * 차지의 레벨별 속성반응 강도(z 필드). 약점 = 1 + z/200, 반감 = 1 − z/200.
 * 파/아/썬 lv30=100, 홀리 lv20=100 → 둘 다 약점 1.50 / 반감 0.50.
 */
export function chargeAttrZ(element: string, level: number): number {
  const id = CHARGE_SKILL_ID[element]
  const sk = id ? findSkillById(id) : undefined
  return sk ? skillNum(skillPropsAtLevel(sk, level), 'z') : 0
}

/** 팔라딘 차지 원소/레벨 → 계산에 필요한 두 수치 */
export function chargeStats(element: string, level: number): { baseMult: number; attrZ: number } {
  return { baseMult: chargeDamagePercent(element, level) / 100, attrZ: chargeAttrZ(element, level) }
}

/**
 * 적용 차지 데미지 계수%(중첩 포함).
 *  단독: mainCoef
 *  중첩: mainCoef + (썬더Coef − 100)   ← 보조 썬더의 보너스 전체를 합산(실측 검증)
 *  예) 파이어 lv30(140) + 썬더 lv30(125) = 140 + 25 = 165%
 */
export function chargeCombinedCoef(mainElement: string, mainLevel: number, thunderLevel: number | null): number {
  const mc = chargeDamagePercent(mainElement, mainLevel)
  if (thunderLevel == null) return mc
  const tc = chargeDamagePercent('lightning', thunderLevel)
  return mc + (tc - 100)
}

/** 직업별 콤보/어드밴스드 콤보 skill id */
export const COMBO_SKILLS: Partial<Record<string, { combo: number; adv: number }>> = {
  hero: { combo: 1111002, adv: 1120003 },
  soulMaster: { combo: 11111001, adv: 11110005 },
}

/**
 * 단일 대상 시전당 라인(타) 수. docs §2.4
 *  - attackCount(브랜디쉬·버스터 등) 우선
 *  - 없으면 bulletCount(표창/화살 다발: 트스3·럭세2·스트레이프4·더블샷2 등)
 *  - 둘 다 없으면 1
 */
export function skillLineCount(skill: IJobSkill, level: number): number {
  const props = skillPropsAtLevel(skill, level)
  if (!props) return 1
  const a = skillNum(props, 'attackCount')
  if (a > 0) return a
  const b = skillNum(props, 'bulletCount')
  return b > 0 ? b : 1
}

/** 특정 레벨에서 스킬의 공격 파라미터(물리 damage% / 마법 mad) */
export function skillAttackAt(skill: IJobSkill, level: number): SkillAttack | null {
  const props = skillPropsAtLevel(skill, level)
  if (!props) return null
  const mad = skillNum(props, 'mad')
  const dmg = skillNum(props, 'damage')
  const rawElement = skill.elementalAttribute || SKILL_ELEMENT_OVERRIDE[skill.description?.name ?? '']
  const element = rawElement ? rawElement.toUpperCase() : undefined
  if (mad > 0) return { kind: 'magic', skillPercent: 100, spellAtk: mad, element, mastery: magicMasteryRatio(props) }
  if (dmg > 0) return { kind: 'physical', skillPercent: dmg, spellAtk: 0, element }
  return null
}
