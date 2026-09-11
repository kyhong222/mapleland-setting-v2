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

/** HP(또는 MP) 한 종류의 구성 */
export interface ResourceParts {
  /** 기본(맨몸) 값 — 미입력이면 null */
  base: number | null
  /** 장비·버프의 고정 가산분 */
  flat: number
  /** 증가율 합(%) — 일반 채널 + 정령의 축복 독립 채널 */
  percent: number
  /** 최종 표시값. base가 null이면 null */
  total: number | null
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

/** 종류별 관련 효과 id (고정, %, 정령의 축복 % 독립 채널) */
export function resourceEffectIds(kind: ResourceKind): EffectId[] {
  const ids = RESOURCE_EFFECT_IDS[kind]
  return [ids.flat, ids.percent, ids.botf]
}

/** 합산 효과 + 기본값 → 한 종류의 구성 */
export function resourceParts(kind: ResourceKind, effects: EffectMap, base: number | null): ResourceParts {
  const ids = RESOURCE_EFFECT_IDS[kind]
  const flat = effects[ids.flat] ?? 0
  // 정령의 축복은 독립 채널이라 여기서 명시적으로 더한다
  const percent = (effects[ids.percent] ?? 0) + (effects[ids.botf] ?? 0)
  return { base, flat, percent, total: base === null ? null : resourceTotal(base, flat, percent) }
}

/** 합산 효과 + 기본 HP/MP → HP·MP 구성 */
export function computeResources(effects: EffectMap, base: { hp: number | null; mp: number | null }): ResourceStats {
  return {
    hp: resourceParts('hp', effects, base.hp),
    mp: resourceParts('mp', effects, base.mp),
  }
}
