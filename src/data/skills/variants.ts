/**
 * 스킬 변형(variant) — 스킬북에 없는 '운용 상황'을 별도 스킬 항목으로 파생한다.
 *
 * 바이퍼 스턴 마스터리(5110000)는 **스턴 상태인 적을 때릴 때만** 크리티컬이 터진다.
 * 예전에는 특화 버프를 켜면 모든 스킬이 스턴 상황을 가정했는데, 실제 운용은
 * 더블 어퍼/백스핀 블로우로 기절을 건 뒤 피스트 등으로 때리는 연계라 스킬마다 상황이 다르다.
 * 그래서 공격 스킬마다 '스킬'과 '스킬 (스턴)' 두 항목을 만들고, 스턴 마스터리의 크리는
 * (스턴) 쪽에만 얹는다.
 *
 * 에너지 버스터는 자체 스턴 확률(prop)이 있어 혼자 난사해도 일부 타격이 스턴 상태로 들어간다.
 * 이 경우만 '(단독 운용)' 변형을 하나 더 둔다.
 *
 * 변형 스킬 id = 기본 id + 오프셋. 아이콘(`/skill-icons/<id>.png`)·모션 규칙(SKILL_MOTION)·
 * 공속표(SKILL_APM)는 전부 **기본 id로** 조회해야 하므로 소비처에서 baseSkillId()로 되돌린다.
 * 오프셋은 실제 스킬 id(최대 8자리, 시그너스 15xxxxxx)와 겹치지 않도록 9자리를 쓴다.
 */

import type { JobId } from '../../domain/jobs'
import type { IJobSkill } from './types'
import { attackSkillsForJob, findSkillById, skillsForJob, skillNum, skillPropsAtLevel } from './index'

/** 스턴 마스터리 skill id — 이 스킬을 가진 직업만 (스턴) 변형을 만든다 */
export const STUN_MASTERY_ID = 5110000

/** 변형 종류: 스턴 상태 가정 / 스턴 확률을 가진 스킬의 단독 운용 */
export type SkillVariantKind = 'stun' | 'soloStun'

/** 변형별 id 오프셋 (실제 스킬 id와 겹치지 않는 9자리) */
const VARIANT_OFFSET: Record<SkillVariantKind, number> = {
  stun: 900_000_000,
  soloStun: 800_000_000,
}

/** 변형별 이름 접미사 */
const VARIANT_SUFFIX: Record<SkillVariantKind, string> = {
  stun: '(스턴)',
  soloStun: '(단독 운용)',
}

/**
 * '(단독 운용)' 변형을 만드는 스킬 — 자체 스턴 확률(levelProperties.prop)을 가진 공격 스킬.
 * 에너지 버스터의 prop은 상류 스킬북에 없어 인게임 값으로 보강했다
 * (scripts/skillbookUpstreamDiff.mjs의 EXPECTED_DIVERGENCE 참고).
 */
const SOLO_STUN_SKILLS: ReadonlySet<number> = new Set([5111002])

/** 변형 스킬 id */
export function variantSkillId(baseId: number, kind: SkillVariantKind): number {
  return baseId + VARIANT_OFFSET[kind]
}

/** 오프셋 큰 것부터 — id 하나가 여러 오프셋보다 클 수 있어 큰 쪽이 먼저 걸려야 한다 */
const VARIANT_KINDS = (Object.keys(VARIANT_OFFSET) as SkillVariantKind[]).sort(
  (a, b) => VARIANT_OFFSET[b] - VARIANT_OFFSET[a],
)

/** 변형 종류 (기본 스킬이면 null) */
export function variantKindOf(skillId: number): SkillVariantKind | null {
  return VARIANT_KINDS.find((k) => skillId > VARIANT_OFFSET[k]) ?? null
}

/** 변형 id → 원래 스킬 id (기본 스킬이면 그대로) */
export function baseSkillId(skillId: number): number {
  const kind = variantKindOf(skillId)
  return kind ? skillId - VARIANT_OFFSET[kind] : skillId
}

/** 기본 스킬 → 변형 스킬 (id와 표시 이름만 바꾼 사본) */
function makeVariant(skill: IJobSkill, kind: SkillVariantKind): IJobSkill {
  const id = variantSkillId(skill.id, kind)
  const name = skill.description?.name ?? String(skill.id)
  return {
    ...skill,
    id,
    description: { ...skill.description, id, name: `${name} ${VARIANT_SUFFIX[kind]}` },
  }
}

/** 해당 직업이 스턴 마스터리를 갖는지 (= 스턴 변형을 만들 직업인지) */
export function hasStunMastery(jobId: JobId): boolean {
  return skillsForJob(jobId).some((s) => s.id === STUN_MASTERY_ID)
}

/**
 * 데미지 계산용 스킬 목록 — 공격 스킬 + 변형.
 * 스턴 마스터리가 없는 직업은 `attackSkillsForJob`과 같다.
 */
export function damageSkillsForJob(jobId: JobId): IJobSkill[] {
  const skills = attackSkillsForJob(jobId)
  if (!hasStunMastery(jobId)) return skills
  return skills.flatMap((s) => [
    s,
    makeVariant(s, 'stun'),
    ...(SOLO_STUN_SKILLS.has(s.id) ? [makeVariant(s, 'soloStun')] : []),
  ])
}

/**
 * 스턴 마스터리가 걸리는 타격 비율 (0~1).
 *
 *  - 기본 스킬     0 — 스턴 상태가 아니라고 본다
 *  - (스턴)        1 — 더블 어퍼/백스핀 블로우 등으로 기절을 걸어 둔 상태
 *  - (단독 운용)   스킬 자체 스턴 확률 prop/100
 *
 * 단독 운용의 근거: 한 타가 prop% 확률로 스턴을 걸면 **다음 타**가 스턴 상태에서 들어간다.
 * 스턴 지속시간이 스킬북에 없어 "한 타 동안 유지"로 두면 정상상태 스턴 비율이 그대로 prop이 된다.
 * (지속시간이 공격 간격보다 길면 실제 비율은 이보다 높아지므로 보수적인 값이다.)
 */
export function stunHitRatio(skillId: number, level: number): number {
  const kind = variantKindOf(skillId)
  if (kind === 'stun') return 1
  if (kind !== 'soloStun') return 0
  const skill = findSkillById(baseSkillId(skillId))
  if (!skill) return 0
  return Math.max(0, Math.min(1, skillNum(skillPropsAtLevel(skill, level), 'prop') / 100))
}
