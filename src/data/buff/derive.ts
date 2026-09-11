/**
 * 버프 레벨표를 스킬북에서 파생한다.
 *
 * 같은 스킬의 레벨별 수치가 스킬북(`data/skills/skillbooks/*.json`)과 버프 JSON 양쪽에
 * 복사돼 있으면, 한쪽만 고쳤을 때 조용히 어긋난다. 실제로 엘리먼트 엠플리피케이션이
 * 스킬북만 갱신되는 바람에 30레벨 150%가 140%로 계산된 적 있다.
 *
 * 그래서 **스킬북을 단일 출처(SSOT)로 삼고**, 버프 JSON에는 값 대신 변환 규칙만 둔다.
 *
 *   { "id": "2110001", "derive": { "amplifiedMagicDamageP": { "field": "y", "offset": -100 } } }
 *
 * 변환은 전부 선형식 하나로 표현된다 — `효과값 = WZ필드값 × scale + offset`.
 * (scale 기본 1, offset 기본 0)
 *
 * 파생할 수 없는 값은 종전대로 `effectsByLevel`에 직접 적는다. 두 방식은 함께 쓸 수 있고,
 * 같은 효과 id가 양쪽에 있으면 `effectsByLevel` 쪽이 이긴다(메소 가드·위협처럼 일부
 * 능력치만 스킬북에 없는 경우). 파생을 쓰지 않는 버프는 스킬북에 없는 것뿐이다
 * (영웅의 메아리·정령의 축복·기상효과·버닝).
 */

import type { Buff, SkillBuff } from '../../domain/buff'
import type { EffectId, EffectMap } from '../../domain/effects'
import { findSkillById, skillPropsAtLevel } from '../skills'

/** 스킬북 levelProperties의 한 필드 → 효과값 변환식 (값 = field × scale + offset) */
export interface BuffDeriveRule {
  /** 스킬북 levelProperties의 필드명 (x / y / pad / pdd / prop / mastery 등) */
  field: string
  /** 곱할 배율. 예: 숙련도 ×5, 부스터 단계 ×-1(WZ가 음수 표기) */
  scale?: number
  /** 더할 상수. 예: 앰플리피케이션 -100(140 → +40%) */
  offset?: number
}

/** 효과 id → 파생 규칙 */
export type BuffDeriveMap = Partial<Record<EffectId, BuffDeriveRule>>

/** JSON 원본 — effectsByLevel과 derive 중 하나 이상을 갖는다 */
type RawSkillBuff = Omit<SkillBuff, 'effectsByLevel'> & {
  effectsByLevel?: EffectMap[]
  derive?: BuffDeriveMap
}
type RawBuff = Exclude<Buff, SkillBuff> | RawSkillBuff

/** 부동소수 오차 정리 (아킬레스 995 × -0.1 + 100 = 0.5) */
function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}

/**
 * derive 규칙으로 레벨별 효과표를 만든다.
 *
 * 키를 넣지 않는 두 경우:
 *  - 해당 레벨에 WZ 필드가 없다 (비홀더스 버프처럼 고레벨에만 붙는 능력치)
 *  - 계산 결과가 0이다 (보우 엑스퍼트 저레벨 물공 등). 합산에서 의미가 없고,
 *    UI 캡션에 '+0'이 뜨는 것도 막는다.
 */
function deriveEffects(buff: RawSkillBuff, derive: BuffDeriveMap): EffectMap[] {
  const skill = findSkillById(Number(buff.id))
  if (!skill) {
    // 스킬북에 없는 id로 파생을 선언한 경우 — 데이터 실수다. 빈 표 대신 기존 값을 쓰게 둔다.
    console.warn(`[buff] derive 대상 스킬을 찾을 수 없음: ${buff.id} ${buff.name}`)
    return buff.effectsByLevel ?? []
  }
  const table: EffectMap[] = []
  for (let lv = 1; lv <= buff.masterLevel; lv++) {
    const props = skillPropsAtLevel(skill, lv)
    const eff: EffectMap = {}
    for (const [id, rule] of Object.entries(derive) as [EffectId, BuffDeriveRule][]) {
      const raw = props?.[rule.field]
      if (raw === undefined) continue
      const value = round3(Number(raw) * (rule.scale ?? 1) + (rule.offset ?? 0))
      if (value !== 0) eff[id] = value
    }
    table.push(eff)
  }
  return table
}

/** JSON 한 벌을 도메인 Buff[]로 정규화 (derive → effectsByLevel 전개) */
export function resolveBuffs(raw: unknown): Buff[] {
  return (raw as RawBuff[]).map((b) => {
    if (b.type !== 'skill' || !b.derive) return b as Buff
    const { derive, ...rest } = b
    const derived = deriveEffects(b, derive)
    // 직접 적은 값이 파생값을 덮는다 (일부 능력치만 스킬북에 없는 버프)
    const literal = b.effectsByLevel ?? []
    return {
      ...rest,
      effectsByLevel: derived.map((eff, i) => ({ ...eff, ...literal[i] })),
    } as Buff
  })
}
