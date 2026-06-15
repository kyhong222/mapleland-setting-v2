/**
 * 공격력 공식 [보류]
 *
 * 구버전(메이플랜드) 물리/마법 MIN·MAX 공격력 공식은 사용자가 직접 제공 예정이며,
 * 별도 세션에서 확정한다. 여기서는 입력 타입과 시그니처 stub만 잡아둔다.
 *
 * 확정 시 함께 다룰 항목:
 *  - 무기상수(constMin/constMax)와 주/부 스탯, 합산 효과(pad/mad/mastery 등)의 결합 방식
 *  - stats.ts의 percent 효과 적용 순서
 */

import type { EffectMap } from './effects'
import type { JobDef } from './jobs'
import type { BaseStats } from './stats'
import type { WeaponType } from './weapons'

/** 공격력 계산 입력 */
export interface AttackPowerInput {
  job: JobDef
  /** 장착 무기 종류(없으면 맨손 등 — 공식 확정 시 처리) */
  weaponType?: WeaponType
  /** 캐릭터 순수 기본 스탯 */
  baseStats: BaseStats
  /** sumEffects로 병합된 전체 효과(장비 + 버프 등) */
  effects: EffectMap
}

export interface AttackPowerResult {
  min: number
  max: number
}

/**
 * TODO: 구버전 공식 확정 후 구현.
 * 현재는 stub으로 0을 반환한다.
 */
export function calcAttackPower(_input: AttackPowerInput): AttackPowerResult {
  return { min: 0, max: 0 }
}
