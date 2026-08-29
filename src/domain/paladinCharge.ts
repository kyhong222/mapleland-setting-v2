/**
 * 차지 — 속성 부여 & 데미지 증가. (docs/nhit-dpm.md §4 차지)
 * 팔라딘 차지 / 소울 차지(소울마스터) / 라이트닝 차지(스트라이커) 공용.
 *
 * 차지 스킬은 **데미지 증가**와 **속성배율** 두 값을 갖는다. 원작은 주차지와 보조차지를
 * 각각 계산해 **더한다**(get_damage_adjusted_by_charged_elemAttr +
 * get_damage_adjusted_by_assist_charged_elemAttr). 곱연산이 아니다.
 *
 *   차지배율 = 주차지(데미지배수 × 속성배수) + 보조차지(chargeBreakdown 참고)
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

/** 보조차지 기여 계수 — 원작 assist 항에 곱해지는 값 */
export const ASSIST_COEF = 0.5

/** 차지배율 한 항(주차지 / 보조차지)의 계산 내역 — 툴팁 표기용 */
export interface ChargeTerm {
  /** '홀리 차지' / '썬더 차지' */
  label: string
  /** 부여 속성코드 (F/I/L/H) */
  elementCode: string
  role: 'main' | 'assist'
  /** 데미지 배수를 %로 (1.5 → 150) */
  damagePercent: number
  reaction: Reaction
  /** 속성배수 (약점 1.5 등) */
  attrMult: number
  /** 보조항이 원작식(−100% 뒤 ×0.5)으로 계산됐는지 */
  halved: boolean
  /** 이 항이 총배율에 더하는 값 */
  value: number
}

export interface ChargeBreakdown {
  terms: ChargeTerm[]
  total: number
}

/**
 * 차지 최종 배율의 항별 내역 — 2단계(PRE_DEFENSE).
 *
 *   차지배율 = 주차지 + 보조차지   (곱연산이 아니라 **합연산**)
 *     주차지   = 데미지배수 × 속성배수
 *     보조차지 = (데미지배수 − 1) × 0.5 × 속성배수      ← 보조 속성이 약점이 아닐 때
 *                데미지배수 × 속성배수 − 1              ← 보조 속성이 약점일 때(메랜)
 *
 * 원작(v95 GMS 디컴파일)은 get_damage_adjusted_by_charged_elemAttr(주)와
 * get_damage_adjusted_by_assist_charged_elemAttr(보조)의 합이며, 보조는 항상
 * `(damage%/100 − 1) × 0.5 × 속성배수`다. 메랜은 **보조 속성이 약점일 때만**
 * 이 −1·×0.5 처리를 하지 않는 것으로 실측 확인됐다.
 *
 * 실측 근거(dcinside 메이플랜드 갤 #3906184, 블래스트 최대뎀 500회+ 표본,
 * MAX = [(최대스공 × 차지배율) − 물방×0.5] × 600%):
 *   무속성 홀+라 1.625 / 성약점 2.375 / 불약점 2.225 / 얼약점 1.775
 *   전기약점(릴리노흐) 2.375 = 1.5 + (1.25×1.5 − 1)
 *   불+전기 2.975 = 2.1 + 0.875 / 얼+전기 2.525 = 1.65 + 0.875
 *   성+전기 3.1875(실측) vs 3.125(본 식) — 8케이스 중 유일하게 위협 +7%가 낀 실험이라
 *   2% 차이는 그 보정 가정에서 나온 것으로 본다.
 * 디컴파일 분석 원문: 같은 갤 #3248293.
 *
 * 주의: 예전 구현은 보조항에서 −1을 빠뜨려 `데미지배수 × 속성배수 × 0.5`를 더했다.
 * 보조 썬더가 약점인 몹에서는 오차가 0~2.6%뿐이라(검증에 쓴 망각의 수호대장이 그
 * 경우였다) 오래 발견되지 않았지만, 약점이 아닌 몹에서는 21~31% 과대평가였다.
 */
export function chargeBreakdown(state: ChargeState, monsterElemAttr: string | undefined): ChargeBreakdown {
  const pReact = elementReaction(monsterElemAttr, ELEM_CODE[state.main])
  const pAttr = attrMultFromZ(pReact, state.attrZ)
  const terms: ChargeTerm[] = [{
    label: `${CHARGE_LABEL[state.main]} 차지`,
    elementCode: ELEM_CODE[state.main],
    role: 'main',
    damagePercent: state.baseMult * 100,
    reaction: pReact,
    attrMult: pAttr,
    halved: false,
    value: state.baseMult * pAttr,
  }]

  const stacked =
    state.thunderLevel != null && state.main !== 'lightning' &&
    state.thunderAttrZ != null && state.thunderBaseMult != null
  if (stacked) {
    const bT = state.thunderBaseMult!
    const tReact = elementReaction(monsterElemAttr, 'L')
    const tAttr = attrMultFromZ(tReact, state.thunderAttrZ!)
    const halved = tReact !== 'weak'
    terms.push({
      label: `${CHARGE_LABEL.lightning} 차지`,
      elementCode: ELEM_CODE.lightning,
      role: 'assist',
      damagePercent: bT * 100,
      reaction: tReact,
      attrMult: tAttr,
      halved,
      value: halved ? (bT - 1) * ASSIST_COEF * tAttr : bT * tAttr - 1,
    })
  }
  return { terms, total: terms.reduce((a, t) => a + t.value, 0) }
}

/** 차지 최종 배율 — chargeBreakdown의 합계 (표기와 계산이 어긋나지 않도록 한 곳에서 만든다) */
export function chargeMultiplier(state: ChargeState, monsterElemAttr: string | undefined): number {
  return chargeBreakdown(state, monsterElemAttr).total
}
