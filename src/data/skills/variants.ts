/**
 * 스킬 변형(variant) — 스킬북에 없는 '운용 상황'을 별도 스킬 항목으로 파생한다.
 *
 * 바이퍼 스턴 마스터리(5110000)는 **스턴 상태인 적을 때릴 때만** 크리티컬이 터진다.
 * 예전에는 특화 버프를 켜면 모든 스킬이 스턴 상황을 가정했는데, 실제 운용은
 * 더블 어퍼/백스핀 블로우로 기절을 건 뒤 피스트 등으로 때리는 연계라 스킬마다 상황이 다르다.
 * 그래서 공격 스킬마다 '스킬'과 '스킬 (스턴)' 두 항목을 만들고, 스턴 마스터리의 크리는
 * (스턴) 쪽에만 얹는다.
 *
 * 에너지 버스터처럼 **자체 스턴 확률(prop)**을 가진 스킬은 혼자 난사해도 일부 타격이 스턴
 * 상태로 들어간다. 그런 스킬은 기본 항목이 곧 단독 운용이라, 기본 쪽에 자체 스턴 확률을 반영한다
 * (별도 '(단독 운용)' 항목을 두었다가 기본과 뜻이 겹쳐 없앴다).
 *
 * 베놈은 중첩 수가 곧 운용 상황이다. 3중첩까지 쌓이고 1틱 데미지가 중첩 수만큼 늘어나므로
 * 기본 항목을 '베놈 (1중첩)'으로 두고 2·3중첩 항목을 파생한다.
 *
 * 소환수는 1회 공격 데미지라 기본 항목 이름을 '프리져 (1회 공격)'으로 바꾼다.
 * 아크메이지의 역속성 소환수(불독 엘퀴네스=얼음, 썬콜 이프리트=불)는 데몬(파이어 데몬/아이스 데몬)이
 * 몬스터의 속성 정보를 지우고 소환수 속성 약점을 부여한 뒤 소환수로 때리는 것이 주 운용이라,
 * 몬스터 원래 속성과 무관하게 약점(×1.5)을 적용하는 '(1회 공격, 약점 적용)' 항목을 파생한다.
 * 기본 항목은 몬스터 원래 속성 그대로 판정한다(원래 약점이면 약점).
 *
 * 차징 스킬(빅뱅·피어싱·스크류 펀치)은 키다운 시간에 따라 데미지가 ⌊90 × t / T⌋ + 10 %로 오른다
 * (최소 10% ~ 풀차징 100%, docs/nhit-dpm.md §4 "차징 스킬"). 기본 항목을 '(풀차징)'으로 두고
 * '(최소 차징)' 항목을 파생한다. 기본 항목은 예전부터 배율 없이(=100%) 계산해 왔으므로 저장된 선택은
 * 풀차징으로 이어진다.
 *
 * 변형은 겹칠 수 있다 — 바이퍼 스크류 펀치는 '(최소 차징) (스턴)'처럼 차징 변형 위에 스턴 변형이 얹힌다.
 * 이때 id에는 두 오프셋이 모두 더해지고, baseSkillId()는 큰 오프셋부터 차례로 벗겨낸다.
 *
 * 변형 스킬 id = 기본 id + 오프셋. 아이콘(`/skill-icons/<id>.png`)·모션 규칙(SKILL_MOTION)·
 * 공속표(SKILL_APM)는 전부 **기본 id로** 조회해야 하므로 소비처에서 baseSkillId()로 되돌린다.
 * 오프셋은 실제 스킬 id(최대 8자리, 3천만대)와 겹치지 않도록 9자리를 쓴다.
 * variantKindOf가 "오프셋보다 크면 그 변형"으로 판정하므로 오프셋끼리 1억 이상 떨어뜨린다.
 * 8억대는 없앤 변형 id(RETIRED_SKILL_IDS)가 쓰던 자리라 새 오프셋으로 쓰지 않는다.
 * 오프셋은 1억의 배수로 둔다 — isSummonSkill 등이 `id % 1억`으로 기본 id를 되돌린다.
 */

import type { JobId } from '../../domain/jobs'
import type { IJobSkill } from './types'
import { attackSkillsForJob, findSkillById, isSummonSkill, skillsForJob, skillNum, skillPropsAtLevel } from './index'

/** 스턴 마스터리 skill id — 이 스킬을 가진 직업만 (스턴) 변형을 만든다 */
export const STUN_MASTERY_ID = 5110000

/** 변형 종류: 스턴 상태 가정 / 베놈 2·3중첩 / 소환수 약점 적용(데몬 연계) / 차징 스킬 최소 차징 */
export type SkillVariantKind = 'stun' | 'venom2' | 'venom3' | 'weak' | 'minCharge'

/**
 * 변형별 id 오프셋 (실제 스킬 id와 겹치지 않는 9자리).
 * 겹치는 조합(minCharge + stun = 12억대)도 int32 안에 들고, 없앤 8억대와도 겹치지 않는다.
 */
const VARIANT_OFFSET: Record<SkillVariantKind, number> = {
  stun: 900_000_000,
  venom2: 600_000_000,
  venom3: 700_000_000,
  weak: 500_000_000,
  minCharge: 300_000_000,
}

/** 변형별 이름 접미사 */
const VARIANT_SUFFIX: Record<SkillVariantKind, string> = {
  stun: '(스턴)',
  venom2: '(2중첩)',
  venom3: '(3중첩, 최대)',
  weak: '(1회 공격, 약점 적용)',
  minCharge: '(최소 차징)',
}

/**
 * 자체 스턴 확률(levelProperties.prop)을 가진 공격 스킬 — 기본 항목에 그 확률이 반영된다.
 * 에너지 버스터의 prop은 상류 스킬북에 없어 인게임 값으로 보강했다
 * (scripts/skillbookUpstreamDiff.mjs의 EXPECTED_DIVERGENCE 참고).
 *
 * 주의: 100% 스턴이라 prop이 없는 스킬(더블 어퍼·백스핀 블로우)은 여기 넣지 않는다.
 * 그 스킬들은 (스턴) 항목으로 고르면 된다.
 */
const SELF_STUN_SKILLS: ReadonlySet<number> = new Set([5111002])

/**
 * 없앤 변형 id → 대신 고를 id. 저장된 선택이 조용히 사라지지 않게 읽을 때만 갈아끼운다.
 *  - 805111002 '에너지 버스터 (단독 운용)': 기본 항목과 뜻이 같아져 제거(2026-09-12).
 *    기본 항목이 자체 스턴 확률을 반영하므로 5111002로 되돌린다.
 */
const RETIRED_SKILL_IDS: ReadonlyMap<number, number> = new Map([[805111002, 5111002]])

/** 변형 스킬 id */
export function variantSkillId(baseId: number, kind: SkillVariantKind): number {
  return baseId + VARIANT_OFFSET[kind]
}

/** 오프셋 큰 것부터 — id 하나가 여러 오프셋보다 클 수 있어 큰 쪽이 먼저 걸려야 한다 */
const VARIANT_KINDS = (Object.keys(VARIANT_OFFSET) as SkillVariantKind[]).sort(
  (a, b) => VARIANT_OFFSET[b] - VARIANT_OFFSET[a],
)

/** 가장 바깥(오프셋이 가장 큰) 변형 종류 (기본 스킬이면 null) */
export function variantKindOf(skillId: number): SkillVariantKind | null {
  return VARIANT_KINDS.find((k) => skillId > VARIANT_OFFSET[k]) ?? null
}

/** 겹친 변형까지 전부 — 큰 오프셋부터 벗겨낸 순서 (기본 스킬이면 빈 배열) */
export function variantKindsOf(skillId: number): SkillVariantKind[] {
  const kinds: SkillVariantKind[] = []
  let id = skillId
  for (let kind = variantKindOf(id); kind; kind = variantKindOf(id)) {
    kinds.push(kind)
    id -= VARIANT_OFFSET[kind]
  }
  return kinds
}

/** 변형 id → 원래 스킬 id (기본 스킬이면 그대로, 겹친 변형도 끝까지 되돌린다) */
export function baseSkillId(skillId: number): number {
  return variantKindsOf(skillId).reduce((id, k) => id - VARIANT_OFFSET[k], skillId)
}

/** 저장된 스킬 선택을 현재 목록에 있는 id로 보정 (없앤 변형 대응) */
export function migrateSkillId(skillId: number): number {
  return RETIRED_SKILL_IDS.get(skillId) ?? skillId
}

/** 베놈(나로·섀도어·나워) — 데미지 계산에서는 중독 1틱으로 다룬다 (docs/nhit-dpm.md §4 베놈) */
export const VENOM_SKILLS: ReadonlySet<number> = new Set([4120005, 4220005, 14110004])

/** 베놈 기본 항목의 표시 이름. id는 그대로라 저장된 선택은 1중첩으로 이어진다 */
const VENOM_BASE_NAME = '베놈 (1중첩)'

/** 스킬의 베놈 중첩 수 — 베놈 기본 항목과 베놈이 아닌 스킬은 1 */
export function venomStacks(skillId: number): number {
  const kind = variantKindOf(skillId)
  return kind === 'venom3' ? 3 : kind === 'venom2' ? 2 : 1
}

/** 베놈이면 1~3중첩 항목으로 펼친다. 베놈이 아니면 그대로 */
function expandVenom(skill: IJobSkill): IJobSkill[] {
  if (!VENOM_SKILLS.has(skill.id)) return [skill]
  const base = { ...skill, description: { ...skill.description, id: skill.id, name: VENOM_BASE_NAME } }
  return [base, makeVariant(skill, 'venom2'), makeVariant(skill, 'venom3')]
}

/**
 * 데몬으로 약점을 부여할 수 있는 역속성 소환수 → 그 데몬 스킬 id.
 *  - 엘퀴네스(불독, 얼음) ← 파이어 데몬 2121003
 *  - 이프리트(썬콜, 불)   ← 아이스 데몬 2221003
 * 플레임위자드 이프리트는 데몬이 없어 기본 항목만 둔다.
 */
export const DEMON_WEAK_SUMMONS: ReadonlyMap<number, number> = new Map([
  [2121005, 2121003],
  [2221005, 2221003],
])

/** 소환수 1회 공격 이름 접미사 */
const SUMMON_BASE_SUFFIX = '(1회 공격)'

/** 소환수면 '(1회 공격)' 항목으로 바꾸고, 역속성 소환수는 약점 적용 항목을 덧붙인다 */
function expandSummon(skill: IJobSkill): IJobSkill[] {
  if (!isSummonSkill(skill)) return [skill]
  const name = skill.description?.name ?? String(skill.id)
  const base = { ...skill, description: { ...skill.description, id: skill.id, name: `${name} ${SUMMON_BASE_SUFFIX}` } }
  return DEMON_WEAK_SUMMONS.has(skill.id) ? [base, makeVariant(skill, 'weak')] : [base]
}

/** 몬스터 원래 속성과 무관하게 약점으로 판정하는 항목인지 (데몬 연계 소환수) */
export function forcesWeakness(skillId: number): boolean {
  return variantKindOf(skillId) === 'weak'
}

/**
 * 차징(키다운) 스킬 — 빅뱅(FP·IL·클레릭) · 피어싱 · 스크류 펀치(바이퍼 · 썬브레이커).
 * 풀차징 시간 T는 버전마다 다르지만(v77 빅뱅·피어싱 2000ms, v95 1000/900ms) 최소 10% · 풀차징 100%는 같다
 * (mnwvs077 CalcDamage.cpp · Rebirth95 · Edelstein 공통).
 */
export const CHARGE_SKILLS: ReadonlySet<number> = new Set([2121001, 2221001, 2321001, 3221001, 5101004, 15101003])

/** 최소 차징 데미지 배율 — ⌊90 × t / T⌋ + 10 %에서 t → 0 */
export const MIN_CHARGE_MULT = 0.1

const FULL_CHARGE_SUFFIX = '(풀차징)'

/** 차징 스킬이면 '(풀차징)' 기본 항목 + '(최소 차징)' 항목으로 펼친다 */
function expandCharge(skill: IJobSkill): IJobSkill[] {
  if (!CHARGE_SKILLS.has(skill.id)) return [skill]
  const name = skill.description?.name ?? String(skill.id)
  const base = { ...skill, description: { ...skill.description, id: skill.id, name: `${name} ${FULL_CHARGE_SUFFIX}` } }
  const min = makeVariant(skill, 'minCharge')
  return [base, min]
}

/** 차징 배율 — 최소 차징 항목이면 0.1, 그 외(풀차징 포함) 1 */
export function chargeMultOf(skillId: number): number {
  return variantKindsOf(skillId).includes('minCharge') ? MIN_CHARGE_MULT : 1
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
  const skills = attackSkillsForJob(jobId).flatMap(expandVenom).flatMap(expandSummon).flatMap(expandCharge)
  if (!hasStunMastery(jobId)) return skills
  return skills.flatMap((s) => [s, makeVariant(s, 'stun')])
}

/**
 * 스턴 마스터리가 걸리는 타격 비율 (0~1).
 *
 *  - (스턴) 변형          1 — 더블 어퍼/백스핀 블로우 등으로 기절을 걸어 둔 상태
 *  - 자체 스턴 확률 보유   prop/100 — 혼자 난사할 때 스턴 상태로 들어가는 몫
 *  - 그 외 기본 스킬      0 — 스턴 상태가 아니라고 본다
 *
 * 자체 스턴 확률의 근거: 한 타가 prop% 확률로 스턴을 걸면 **다음 타**가 스턴 상태에서 들어간다.
 * 스턴 지속시간이 스킬북에 없어 "한 타 동안 유지"로 두면 정상상태 스턴 비율이 그대로 prop이 된다.
 * (지속시간이 공격 간격보다 길면 실제 비율은 이보다 높아지므로 보수적인 값이다.)
 */
export function stunHitRatio(skillId: number, level: number): number {
  if (variantKindOf(skillId) === 'stun') return 1
  const base = baseSkillId(skillId)
  if (!SELF_STUN_SKILLS.has(base)) return 0
  const skill = findSkillById(base)
  if (!skill) return 0
  return Math.max(0, Math.min(1, skillNum(skillPropsAtLevel(skill, level), 'prop') / 100))
}
