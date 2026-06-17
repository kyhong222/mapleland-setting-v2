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
 * 총 공격력 = (장비+패시브+버프 공격력 + 추가공격력) × (1 + 공격력%/100)
 * (장비·패시브·버프 공격력은 모두 effects.pad로 합산되어 있다)
 */
export function totalAttack(effects: EffectMap): number {
  const flat = (effects.pad ?? 0) + (effects.addPad ?? 0)
  return Math.floor(flat * (1 + (effects.padP ?? 0) / 100))
}

/**
 * 총 마력 = (장비+버프 마력 + 추가마력 + 총 지력) × (1 + 마력%/100)
 * @param totalInt 최종 지력(스탯 공식 적용 후)
 */
export function totalMagic(effects: EffectMap, totalInt: number): number {
  const flat = (effects.mad ?? 0) + (effects.addMad ?? 0) + totalInt
  return Math.floor(flat * (1 + (effects.madP ?? 0) / 100))
}

/**
 * TODO: 구버전 MIN/MAX 데미지 공식 확정 후 구현.
 * 현재는 stub으로 0을 반환한다.
 */
export function calcAttackPower(_input: AttackPowerInput): AttackPowerResult {
  return { min: 0, max: 0 }
}
