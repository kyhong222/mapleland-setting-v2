/**
 * 차지 — 속성 부여 & 데미지 증가. (docs/nhit-dpm.md §4 차지)
 * 팔라딘 차지 / 소울 차지(소울마스터) / 라이트닝 차지(스트라이커) 공용.
 *
 * 차지 스킬은 **데미지 증가**와 **속성배율** 두 값을 갖는다. 원작은 주차지와 보조차지를
 * 각각 계산해 **더한다**(get_damage_adjusted_by_charged_elemAttr +
 * get_damage_adjusted_by_assist_charged_elemAttr). 곱연산이 아니다.
 *
 *   차지배율 = 주차지계수 × 속성배수(주) + 보조차지계수 × 속성배수(보조) × 0.5
 *
 * 예) 파이어 차지 마스터(데미지 140%, 속성배수 약점 1.5) 단독
 *   - 무반응 1.40 / 약점 2.10 / 반감 0.70 / 무효 0
 *
 * 두 값 모두 WZ 레벨속성에서 온다:
 *  - 데미지배수 = `damage`/100  (플레임 140 / 블리자드 110 / 선더 125 / 홀리 150 /
 *                              소울·라이트닝 120 — 차지마다 다르다)
 *  - 속성배수  = `z` 기반 (아래 attrMultFromZ). 원작 디컴파일과 계수가 일치한다.
 *      파/아/썬 z = 13+(L−1)×3 → L30 100 → 약점 1.50 / 반감 0.50 / 무효 0
 *      홀리/디바인 z = 43+(L−1)×3 → L20 100 → 동일
 *      소울/라이트닝 z = 12+(L−1)×2 → L20 50 → 약점 1.25 / 반감 0.75 / 무효 0.5
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
  /** 주차지 데미지배수 = damage/100 */
  baseMult: number
  /** 주차지 속성반응 강도(z) */
  attrZ: number
  /** 보조 썬더 데미지배수 — 중첩 시에만 */
  thunderBaseMult?: number
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
    thunderBaseMult: thunderLevel != null ? stats('lightning', thunderLevel).baseMult : undefined,
    thunderAttrZ: thunderLevel != null ? stats('lightning', thunderLevel).attrZ : undefined,
  }
}

/**
 * 차지가 실제로 부여하는 속성코드 목록.
 * 보조 썬더가 걸려 있으면 주차지 속성 + 번개 두 개가 된다.
 */
export function chargeElementCodes(state: ChargeState): string[] {
  const codes = [ELEM_CODE[state.main]]
  if (state.thunderLevel != null && state.main !== 'lightning') codes.push('L')
  return codes
}

/**
 * 속성배수 — 원작 get_damage_adjusted_by_elemAttr 재현.
 *   무효(1) : 1 − z/100      ← z<100이면 0이 아니다. 시그너스 차지(z=50)는 50%가 들어간다
 *   반감(2) : 1 − z/200
 *   약점(3) : 1 + z/200      (원작은 1 미만으로 내려가지 않게 바닥을 둔다)
 *   무반응  : 1.0
 * a3 = z/100 을 대입하면 디컴파일 코드의 계수와 전 case에서 일치한다.
 */
export function attrMultFromZ(reaction: Reaction, z: number): number {
  if (reaction === 'immune') return Math.max(0, 1 - z / 100)
  if (reaction === 'weak') return Math.max(1, 1 + z / 200)
  if (reaction === 'half') return 1 - z / 200
  return 1.0
}

/** 보조차지 기여 계수 — 원작 구조상 assist 항에 곱해지는 값 */
export const ASSIST_COEF = 0.5

/**
 * 차지 최종 배율 — 2단계(PRE_DEFENSE).
 *
 *   차지배율 = 주차지계수 × 속성배수(주)  +  보조차지계수 × 속성배수(보조) × 0.5
 *
 * 원작은 get_damage_adjusted_by_charged_elemAttr(주) 와
 * get_damage_adjusted_by_assist_charged_elemAttr(보조) 의 **합**으로 구현돼 있다.
 * 곱연산이 아니라 합연산이라는 점이 핵심.
 *
 * 실측 대조(망각의 수호대장 8200012, S3I3L3 = 얼음·번개 약점, 아이스30+썬더30 마스터):
 *   1.10×1.5 + 1.25×1.5×0.5 = 2.5875 → 예상 23213~44060 / 실측 22945~42620 (최소측 1.15% 차)
 * 파이프라인 자체에 1% 안팎 오차가 있는 것으로 보이며(피격 데미지 실측에서도 동일),
 * 이 범위 안에서 가장 잘 맞는 후보다. 대안(보조도 주차지 계수 사용, 2.4750)은 1.32% 차.
 */
export function chargeMultiplier(state: ChargeState, monsterElemAttr: string | undefined): number {
  const pReact = elementReaction(monsterElemAttr, ELEM_CODE[state.main])
  let mult = state.baseMult * attrMultFromZ(pReact, state.attrZ)
  const stacked =
    state.thunderLevel != null && state.main !== 'lightning' &&
    state.thunderAttrZ != null && state.thunderBaseMult != null
  if (stacked) {
    const tReact = elementReaction(monsterElemAttr, 'L')
    mult += state.thunderBaseMult! * attrMultFromZ(tReact, state.thunderAttrZ!) * ASSIST_COEF
  }
  return mult
}
