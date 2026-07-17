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

/** 공격 스킬 여부 (물리 damage 또는 마법 mad 보유; 차지/메디테이션 등 버프 제외) */
export function isAttackSkill(skill: IJobSkill): boolean {
  const name = skill.description?.name ?? ''
  if (name.includes('차지') || name === '메디테이션') return false
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
}

/** 특정 레벨에서 스킬의 공격 파라미터(물리 damage% / 마법 mad) */
export function skillAttackAt(skill: IJobSkill, level: number): SkillAttack | null {
  const props = skillPropsAtLevel(skill, level)
  if (!props) return null
  const mad = skillNum(props, 'mad')
  const dmg = skillNum(props, 'damage')
  const element = skill.elementalAttribute ? skill.elementalAttribute.toUpperCase() : undefined
  if (mad > 0) return { kind: 'magic', skillPercent: 100, spellAtk: mad, element }
  if (dmg > 0) return { kind: 'physical', skillPercent: dmg, spellAtk: 0, element }
  return null
}
