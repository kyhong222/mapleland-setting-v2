/**
 * 차지 — 속성 부여 & 속성반응 대체. (docs/nhit-dpm.md §4 차지)
 * 팔라딘 차지 / 소울 차지(소울마스터) / 라이트닝 차지(스트라이커) 공용.
 *
 * 차지 스킬은 **데미지 증가**와 **속성배율** 두 값을 함께 갖고 있고, 서로 곱해진다.
 *
 *   차지배율 = 데미지배수 × 속성배수
 *
 * 예) 데미지 140%, 속성배율 150%인 차지
 *   - 무속성(무반응) 몬스터 → 1.40  (데미지 증가만)
 *   - 약점 몬스터           → 1.40 × 1.50 = 2.10
 *   - 반감 몬스터           → 1.40 × 0.50 = 0.70
 *   - 무효 몬스터           → 0
 *
 * 두 값 모두 WZ 레벨속성에서 온다:
 *  - 데미지배수 = `damage`/100  (플레임 140 / 블리자드 110 / 선더 125 / 홀리 150 /
 *                              소울·라이트닝 120 — 차지마다 다르다)
 *  - 속성배수  = `z` 기반. 약점 1 + z/200, 반감 1 − z/200, 무반응 1.0, 무효 0.
 *      파/아/썬 z = 13+(L−1)×3 → L30 100 → 1.50/0.50
 *      홀리/디바인 z = 43+(L−1)×3 → L20 100 → 1.50/0.50
 *      소울/라이트닝 z = 12+(L−1)×2 → L20 50 → 1.25/0.75
 *    이 한 줄이 구 문서의 하드코딩 두 공식(파아썬 1.05+L×0.015 / 홀리 1.20+L×0.015)을
 *    전 레벨에서 정확히 재현한다.
 *
 * 중첩차지(주차지 P + 보조 썬더 T): 속성배수만 합연산으로 섞고 데미지배수를 곱한다.
 *   속성배수 = 배수(P) + (배수(T) − 1) × 0.5,  단 P·T 중 무효가 있으면 0.
 */

import { elementReaction } from './monster'

export type ChargeElement = 'fire' | 'ice' | 'lightning' | 'holy'

/** 차지 원소 → 속성코드(F/I/L/H) */
const ELEM_CODE: Record<ChargeElement, string> = { fire: 'F', ice: 'I', lightning: 'L', holy: 'H' }

/** 차지 원소 → 마스터레벨 (홀리 20, 그 외 30) */
export const CHARGE_MASTER: Record<ChargeElement, number> = { fire: 30, ice: 30, lightning: 30, holy: 20 }

/** 차지 원소 → 표시명 */
export const CHARGE_LABEL: Record<ChargeElement, string> = { fire: '파이어', ice: '아이스', lightning: '썬더', holy: '홀리' }

/** 선택 가능한 주차지 목록(표시 순) */
export const CHARGE_ELEMENTS: ChargeElement[] = ['fire', 'ice', 'lightning', 'holy']

/** 차지 UI 상태(메인/보조) — buildStore와 공유 */
export interface ChargeUiState {
  mainOn: boolean
  mainElement: ChargeElement
  mainLevel: number
  subOn: boolean
  subLevel: number
}

type Reaction = ReturnType<typeof elementReaction>

/** 원소/레벨 → 스킬 원본 수치. data/skills의 chargeStats를 넘긴다(도메인은 데이터에 의존하지 않음). */
export type ChargeStatsResolver = (element: ChargeElement, level: number) => { baseMult: number; attrZ: number }

export interface ChargeState {
  /** 주차지 원소 (썬더단독이면 lightning) */
  main: ChargeElement
  mainLevel: number
  /** 보조 썬더 중첩 레벨 (없으면 null) */
  thunderLevel: number | null
  /** 데미지배수 = damage/100 */
  baseMult: number
  /** 주차지 속성반응 강도(z) */
  attrZ: number
  /** 보조 썬더 속성반응 강도(z) — 중첩 시에만 */
  thunderAttrZ?: number
}

/**
 * 차지 UI 상태 → 계산용 ChargeState (꺼져있으면 null).
 *  - 메인차지 off → null
 *  - 메인이 썬더가 아니고 보조(썬더) on → 중첩(thunderLevel)
 */
export function chargeFromUi(c: ChargeUiState, stats: ChargeStatsResolver): ChargeState | null {
  if (!c.mainOn) return null
  const thunderLevel = c.mainElement !== 'lightning' && c.subOn ? c.subLevel : null
  const main = stats(c.mainElement, c.mainLevel)
  return {
    main: c.mainElement,
    mainLevel: c.mainLevel,
    thunderLevel,
    baseMult: main.baseMult,
    attrZ: main.attrZ,
    thunderAttrZ: thunderLevel != null ? stats('lightning', thunderLevel).attrZ : undefined,
  }
}

/** 속성배수: 무효 0, 약점 1 + z/200, 반감 1 − z/200, 무반응 1.0 */
export function attrMultFromZ(reaction: Reaction, z: number): number {
  if (reaction === 'immune') return 0
  if (reaction === 'weak') return 1 + z / 200
  if (reaction === 'half') return 1 - z / 200
  return 1.0
}

/**
 * 차지의 속성배수 (중첩 포함). 무효가 하나라도 있으면 0.
 * 중첩: 배수(P) + (배수(T) − 1) × 0.5
 */
export function chargeAttrMult(state: ChargeState, monsterElemAttr: string | undefined): number {
  const pReact = elementReaction(monsterElemAttr, ELEM_CODE[state.main])
  const p = attrMultFromZ(pReact, state.attrZ)
  if (state.thunderLevel == null || state.main === 'lightning' || state.thunderAttrZ == null) return p
  const tReact = elementReaction(monsterElemAttr, 'L')
  if (pReact === 'immune' || tReact === 'immune') return 0
  return p + (attrMultFromZ(tReact, state.thunderAttrZ) - 1) * 0.5
}

/**
 * 차지 최종 배율 — 2단계(PRE_DEFENSE).
 *   차지배율 = 데미지배수 × 속성배수
 */
export function chargeMultiplier(state: ChargeState, monsterElemAttr: string | undefined): number {
  return state.baseMult * chargeAttrMult(state, monsterElemAttr)
}
