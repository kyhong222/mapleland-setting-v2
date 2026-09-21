/**
 * HP/MP 최대치 계산.
 *
 * 구성(기획안 [docs/plan.md] §1 "HP / MP"): ① 장비 고정 HP/MP ② 정령의 축복 %
 * ③ 아이템 %(카오스 자쿰의 투구) ④ 하이퍼 바디 %. 실측 대조 결과 한 줄로 전부 설명된다.
 *
 *   최종 = ⌊(기본 + 고정) × (1 + %합 / 100)⌋
 *
 * 실측(기본 HP 13238인 캐릭터, 고정분 = 결혼링60 + 메이플이어링25 + 안경20 + 칭호100):
 *
 *   | 고정 | %합 | 인게임 표시 | 조합                        |
 *   |-----:|----:|-----------:|-----------------------------|
 *   |    0 |  10 |      14561 | 정령의 축복 12              |
 *   |  205 |  10 |      14787 | + 고정 HP 장비              |
 *   |  205 |  20 |      16131 | + 카오스 자쿰의 투구        |
 *   |  205 |  80 |      24197 | + 하이퍼 바디 30            |
 *
 * 이 4건이 세 가지를 각각 확정한다.
 *  - 고정분은 % **안쪽**에 들어간다 — 밖에서 더하면 2행이 14766이 되어 어긋난다.
 *  - % 는 **가산**이다 — 3행이 곱연산(1.1 × 1.1)이면 16265다.
 *  - 끝수는 **버림**이다 — 3행이 반올림이면 16132다.
 *
 * 기본(맨몸) HP/MP는 레벨업 랜덤 증가·AP 투자·HP증가 패시브로 정해져 레벨/직업만으로
 * 유도할 수 없다. 그래서 사용자가 인게임 표시값을 넣으면 baseFromShown()으로 역산해
 * 기본값만 보관하고, 이후에는 그 기본값에 현재 세팅을 다시 씌워 계산한다.
 *
 * **보관한 기본값은 입력 당시 레벨에서만 유효하다.** 레벨이 오르면 맨몸 HP/MP도 같이 오르는데
 * 그 증가량 역시 랜덤이라 유도할 수 없기 때문이다. 그래서 값과 레벨을 짝으로 보관하고, 현재
 * 레벨이 다르면 최종치를 내지 않는다(total = null) — 지금 얹히는 몫만 "+x +y%"로 보여주는
 * 미입력 상태 표기로 돌아가 "다시 넣어야 한다"를 알린다. 레벨만 어긋났을 뿐 값은 지우지
 * 않으므로 원래 레벨로 돌아오면 그대로 되살아난다.
 *
 * 부동소수 끝수 문제를 피하려고 %는 (100 + p) / 100 꼴의 정수 연산으로 다룬다.
 */

import type { EffectId, EffectMap } from './effects'

/** HP/MP 두 종류 */
export type ResourceKind = 'hp' | 'mp'

/**
 * 종류별 효과 id.
 * botf(정령의 축복)는 "무조건 중첩되는" 독립 채널이라 자동 합산되지 않는다
 * — 아래 resourceParts()가 소비처로서 명시적으로 더한다(CLAUDE.md "독립 채널" 참고).
 */
const RESOURCE_EFFECT_IDS: Record<ResourceKind, { flat: EffectId; percent: EffectId; botf: EffectId }> = {
  hp: { flat: 'hp', percent: 'hpP', botf: 'hpP_botf' },
  mp: { flat: 'mp', percent: 'mpP', botf: 'mpP_botf' },
}

/** HP/MP 계산에 관여하는 효과 id 전부 (기여 요소 추출용) */
export const RESOURCE_IDS: readonly EffectId[] = ['hp', 'mp', 'hpP', 'mpP', 'hpP_botf', 'mpP_botf']

/**
 * 보관 중인 기본(맨몸) 값 — 입력 당시 레벨과 짝으로 다닌다.
 * 다른 레벨에서는 쓸 수 없다(위 주석 참고).
 */
export interface BaseResource {
  /** 역산해 보관한 맨몸 값 — 미입력이면 null */
  value: number | null
  /** value를 입력한 시점의 캐릭터 레벨. 레벨을 기록하기 전 데이터는 null(검사 생략) */
  level: number | null
}

/** HP(또는 MP) 한 종류의 구성 */
export interface ResourceParts {
  /** 기본(맨몸) 값 — 미입력이면 null */
  base: number | null
  /** 장비·버프의 고정 가산분 */
  flat: number
  /** 증가율 합(%) — 일반 채널 + 정령의 축복 독립 채널 */
  percent: number
  /** 최종 표시값. base가 없거나 다른 레벨에서 입력한 값(staleLevel)이면 null */
  total: number | null
  /** 입력 당시 레벨이 현재 레벨과 다를 때 그 레벨. 아니면 null */
  staleLevel: number | null
}

export type ResourceStats = Record<ResourceKind, ResourceParts>

/** 최종값 = ⌊(기본 + 고정) × (1 + %/100)⌋ */
export function resourceTotal(base: number, flat: number, percent: number): number {
  return Math.floor(((base + flat) * (100 + percent)) / 100)
}

/**
 * 인게임 표시값 → 기본(맨몸) 값 역산. resourceTotal의 역함수.
 *
 * ⌊x × m⌋ = shown 인 정수 x의 최솟값이 ⌈shown / m⌉이므로 거기서 고정분을 뺀다.
 * (버림 때문에 원래 x의 후보가 여러 개일 수는 없다 — m ≥ 1이라 구간 길이가 1 이하다.)
 */
export function baseFromShown(shown: number, flat: number, percent: number): number {
  return Math.max(0, Math.ceil((shown * 100) / (100 + percent)) - flat)
}

/**
 * 보관값에 딸린 "입력 당시 레벨"을 복원한다.
 *
 * 레벨을 기록하기 전에 저장된 데이터(구 localStorage·저장슬롯·클라우드 행)에는 이 값이 없다.
 * 모른다고 비워두면 멀쩡히 쓰던 값이 전부 "레벨이 바뀌었으니 다시 입력" 상태로 보이므로,
 * **그 데이터가 담고 있던 레벨에서 넣은 것으로 본다** — 실제로도 대개 그렇다.
 */
export function baseLevelOf(
  value: number | null | undefined,
  level: number | null | undefined,
  fallback: number,
): number | null {
  if (value == null) return null
  return level ?? fallback
}

/** 종류별 관련 효과 id (고정, %, 정령의 축복 % 독립 채널) */
export function resourceEffectIds(kind: ResourceKind): EffectId[] {
  const ids = RESOURCE_EFFECT_IDS[kind]
  return [ids.flat, ids.percent, ids.botf]
}

/**
 * 합산 효과 + 보관값 → 한 종류의 구성.
 * `level`은 현재 캐릭터 레벨 — 보관값의 레벨과 다르면 최종치를 내지 않는다.
 */
export function resourceParts(kind: ResourceKind, effects: EffectMap, base: BaseResource, level: number): ResourceParts {
  const ids = RESOURCE_EFFECT_IDS[kind]
  const flat = effects[ids.flat] ?? 0
  // 정령의 축복은 독립 채널이라 여기서 명시적으로 더한다
  const percent = (effects[ids.percent] ?? 0) + (effects[ids.botf] ?? 0)
  const staleLevel = base.value !== null && base.level !== null && base.level !== level ? base.level : null
  const total = base.value === null || staleLevel !== null ? null : resourceTotal(base.value, flat, percent)
  return { base: base.value, flat, percent, total, staleLevel }
}

/** 합산 효과 + 기본 HP/MP → HP·MP 구성 */
export function computeResources(
  effects: EffectMap,
  base: Record<ResourceKind, BaseResource>,
  level: number,
): ResourceStats {
  return {
    hp: resourceParts('hp', effects, base.hp, level),
    mp: resourceParts('mp', effects, base.mp, level),
  }
}
