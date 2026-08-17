/**
 * 팔라딘 차지 — 속성 부여 & 속성반응 대체. (docs/nhit-dpm.md §4 차지)
 *
 * 차지 사용 시 물리공격이 해당 속성이 되며, 몬스터 속성반응(약점/반감/무효)을
 * 차지 스킬레벨 의존 배율로 대체한다. (§3-3 고정 속성반응을 대체)
 *
 * 주차지 배율 (L = 차지 스킬레벨):
 *  - 약점: (홀리 1.20 / 그외 1.05) + L×0.015   → 파/아/썬 마스터(30) 1.50, 홀리 마스터(20) 1.50
 *  - 반감: (홀리 0.80 / 그외 0.95) − L×0.015   → 마스터 0.50
 *  - 무반응 1.0 / 무효 0
 *
 * 중첩차지(주차지 P + 보조 썬더 T): P·T 중 무효 있으면 0, 아니면 Pmult + (Tmult−1)×0.5.
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

/**
 * 차지 UI 상태 → 계산용 ChargeState (꺼져있거나 미해당이면 null).
 *  - 메인차지 off → null
 *  - 메인이 썬더가 아니고 보조(썬더) on → 중첩(thunderLevel)
 */
export function chargeFromUi(c: ChargeUiState): ChargeState | null {
  if (!c.mainOn) return null
  const thunderLevel = c.mainElement !== 'lightning' && c.subOn ? c.subLevel : null
  return { main: c.mainElement, mainLevel: c.mainLevel, thunderLevel }
}

type Reaction = ReturnType<typeof elementReaction>

export interface ChargeState {
  /** 주차지 원소 (썬더단독이면 lightning) */
  main: ChargeElement
  mainLevel: number
  /** 보조 썬더 중첩 레벨 (없으면 null) */
  thunderLevel: number | null
  /**
   * 기본배수 직접 지정. 팔라딘 차지는 계수표(chargeBaseMult)를 쓰지만,
   * 스킬 원본의 damage%가 곧 기본배수인 차지(스트라이커 라이트닝 차지 등)는
   * damage/100을 여기에 넣는다. 없으면 계수표를 쓴다.
   */
  baseMult?: number
}

// ── ORIGINAL_V86 통합 차지 모델 ────────────────────────────────────────
// 원작 고증(GMS v86/v95). 속성반응과 데미지 계수를 하나의 배율로 통합한다.

export type ChargeStackRule = 'ORIGINAL_V86' | 'MAPLELAND_CURRENT'

/** 현재 사용 규칙 (실측 확보 시 교체 가능) */
export const CHARGE_STACK_RULE: ChargeStackRule = 'ORIGINAL_V86'

/** 보조(썬더) 차지 기여 계수 — ORIGINAL_V86: (1.25−1)×0.5=0.125, MAPLELAND_CURRENT: 0.625 */
const ASSIST_COEF: Record<ChargeStackRule, number> = { ORIGINAL_V86: 0.125, MAPLELAND_CURRENT: 0.625 }

/**
 * 팔라딘 차지 기본배수.
 *  불/얼음/전기: 1레벨 13, 레벨당 +3 → 30레벨 100
 *  홀리/디바인: 1레벨 43, 레벨당 +3 → 20레벨 100
 *  기본배수 = 1 + 내부수치/100  (예: 파이어 30레벨 = 1 + 100/100 = 2.0)
 *
 * ❓ 이 "내부 수치"는 WZ `z` 필드와 전 레벨 일치하는데, z는 아래 attrMult가 쓰는
 *   속성반응 강도이기도 하다(약점 = 1 + z/200). 즉 z를 기본배수와 속성반응에
 *   중복으로 쓰고 있을 가능성이 있다. 데미지 계수라면 `damage` 필드(플레임 140 /
 *   블리자드 110 / 선더 125 / 홀리 150)를 써야 한다. 실측 전까지 종전 동작 유지.
 *   docs/nhit-dpm.md "차지 모델 미해결 사항" 참조.
 */
export function chargeBaseMult(el: ChargeElement, level: number): number {
  const internal = (el === 'holy' ? 43 : 13) + (level - 1) * 3
  return 1 + internal / 100
}

/**
 * 속성배수 (docs/nhit-dpm.md §4). 면역 0 / 무반응 1.0.
 *  - 파이어·아이스·썬더: 약점 1.05+L×0.015, 반감 0.95−L×0.015  → 마스터(L30) 1.50 / 0.50
 *  - 홀리(성): 약점 1.20+L×0.015, 반감 0.80−L×0.015            → 마스터(L20) 1.50 / 0.50
 * 홀리는 마스터레벨이 20이라 같은 1.50/0.50에 도달하도록 계수가 다르다.
 * 소울 차지(성, 마스터 20)도 약점 1.50 / 반감 0.50으로 확인됨.
 */
function attrMult(reaction: Reaction, level: number, holy: boolean): number {
  if (reaction === 'immune') return 0
  if (reaction === 'weak') return (holy ? 1.2 : 1.05) + level * 0.015
  if (reaction === 'half') return (holy ? 0.8 : 0.95) - level * 0.015
  return 1.0
}

/**
 * 차지 통합 배율(속성반응 + 계수) — 2단계(PRE_DEFENSE).
 *  차지배율 = 1 + 기본차지_기여 + 보조차지_기여
 *  기본_기여 = (기본배수 − 1) × 속성배수(주차지)
 *  보조_기여 = ASSIST_COEF × 속성배수(썬더)      ← 썬더 중첩 시에만
 * 각 차지는 자기 속성/레벨로 따로 판정한다. 면역인 차지의 기여만 0이 되며,
 * 배율 자체는 1 미만으로 내려가지 않는 물리 데미지를 유지한다.
 *
 * 팔라딘 외에도 같은 모델을 쓰는 차지가 있다(스트라이커 라이트닝 차지 —
 * state.baseMult로 스킬 원본 damage%를 넘긴다).
 */
export function chargeMultiplier(
  state: ChargeState,
  monsterElemAttr: string | undefined,
  rule: ChargeStackRule = CHARGE_STACK_RULE,
): number {
  const pReact = elementReaction(monsterElemAttr, ELEM_CODE[state.main])
  const base = state.baseMult ?? chargeBaseMult(state.main, state.mainLevel)
  const primary = (base - 1) * attrMult(pReact, state.mainLevel, state.main === 'holy')
  let assist = 0
  if (state.thunderLevel != null && state.main !== 'lightning') {
    const aReact = elementReaction(monsterElemAttr, 'L')
    assist = ASSIST_COEF[rule] * attrMult(aReact, state.thunderLevel, false)
  }
  return 1 + primary + assist
}
