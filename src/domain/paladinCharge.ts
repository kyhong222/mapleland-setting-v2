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

/** 단일 차지의 반응배율 (무효는 'immune') */
function reactionMult(reaction: Reaction, level: number, holy: boolean): number | 'immune' {
  if (reaction === 'immune') return 'immune'
  if (reaction === 'weak') return (holy ? 1.2 : 1.05) + level * 0.015
  if (reaction === 'half') return (holy ? 0.8 : 0.95) - level * 0.015
  return 1.0 // none(무반응)
}

export interface ChargeState {
  /** 주차지 원소 (썬더단독이면 lightning) */
  main: ChargeElement
  mainLevel: number
  /** 보조 썬더 중첩 레벨 (없으면 null) */
  thunderLevel: number | null
}

/**
 * 차지 최종 속성배율 (§4 단독/중첩). 몬스터 무효 시 0.
 */
export function chargeElementMult(state: ChargeState, monsterElemAttr: string | undefined): number {
  const pMult = reactionMult(elementReaction(monsterElemAttr, ELEM_CODE[state.main]), state.mainLevel, state.main === 'holy')
  // 단독차지 (또는 주차지가 썬더 = 썬더단독)
  if (state.thunderLevel == null || state.main === 'lightning') {
    return pMult === 'immune' ? 0 : pMult
  }
  // 중첩차지: 주차지 P + 보조 썬더 T
  const tMult = reactionMult(elementReaction(monsterElemAttr, 'L'), state.thunderLevel, false)
  if (pMult === 'immune' || tMult === 'immune') return 0
  return pMult + (tMult - 1) * 0.5
}

// ── ORIGINAL_V86 통합 차지 모델 (팔라딘) ───────────────────────────────
// 원작 고증(GMS v86/v95). 속성반응과 데미지 계수를 하나의 배율로 통합한다.

export type ChargeStackRule = 'ORIGINAL_V86' | 'MAPLELAND_CURRENT'

/** 현재 사용 규칙 (실측 확보 시 교체 가능) */
export const CHARGE_STACK_RULE: ChargeStackRule = 'ORIGINAL_V86'

/** 보조(썬더) 차지 기여 계수 — ORIGINAL_V86: (1.25−1)×0.5=0.125, MAPLELAND_CURRENT: 0.625 */
const ASSIST_COEF: Record<ChargeStackRule, number> = { ORIGINAL_V86: 0.125, MAPLELAND_CURRENT: 0.625 }

/**
 * 차지 스킬 내부 수치 → 기본 배수.
 *  불/얼음/전기: 1레벨 13, 레벨당 +3 → 30레벨 100
 *  홀리/디바인: 1레벨 43, 레벨당 +3 → 20레벨 100
 *  기본배수 = 1 + 내부수치/100  (예: 파이어 30레벨 = 1 + 100/100 = 2.0)
 */
export function chargeBaseMult(el: ChargeElement, level: number): number {
  const internal = (el === 'holy' ? 43 : 13) + (level - 1) * 3
  return 1 + internal / 100
}

/** 속성배수: 면역 0, 약점 1.05+L×0.015, 반감 0.95−L×0.015, 무반응 1.0 */
function attrMult(reaction: Reaction, level: number): number {
  if (reaction === 'immune') return 0
  if (reaction === 'weak') return 1.05 + level * 0.015
  if (reaction === 'half') return 0.95 - level * 0.015
  return 1.0
}

/**
 * 팔라딘 차지 통합 배율(속성반응 + 계수) — 2단계(PRE_DEFENSE).
 *  차지배율 = 1 + 기본차지_기여 + 보조차지_기여
 *  기본_기여 = (기본배수 − 1) × 속성배수(주차지)
 *  보조_기여 = ASSIST_COEF × 속성배수(썬더)      ← 썬더 중첩 시에만
 * 각 차지는 자기 속성/레벨로 따로 판정한다. 면역인 차지의 기여만 0이 되며,
 * 배율 자체는 1 미만으로 내려가지 않는 물리 데미지를 유지한다.
 */
export function chargeMultiplier(
  state: ChargeState,
  monsterElemAttr: string | undefined,
  rule: ChargeStackRule = CHARGE_STACK_RULE,
): number {
  const pReact = elementReaction(monsterElemAttr, ELEM_CODE[state.main])
  const primary = (chargeBaseMult(state.main, state.mainLevel) - 1) * attrMult(pReact, state.mainLevel)
  let assist = 0
  if (state.thunderLevel != null && state.main !== 'lightning') {
    const aReact = elementReaction(monsterElemAttr, 'L')
    assist = ASSIST_COEF[rule] * attrMult(aReact, state.thunderLevel)
  }
  return 1 + primary + assist
}
