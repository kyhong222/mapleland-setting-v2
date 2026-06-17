/**
 * 버프/도핑/스킬 효과 도메인.
 *
 * 크게 두 타입:
 *  - item  : 아이템(도핑 등). 전 직업 공용, 항상 고정 효과.
 *  - skill : 스킬. (파티/개인) × (액티브/패시브)로 분류하며, 레벨별 효과를
 *            마스터레벨까지 정의한다.
 *
 * 스킬 적용 범위(scope):
 *  - party    : 파티스킬. 타 직업에게 받을 수 있으므로 본 서비스에선 전 직업 사용 가능.
 *  - personal : 개인스킬. 사용 가능한 직업(jobs)을 명시. 스킬 UI는 선택된 직업에
 *               해당하는 개인스킬만 구성한다.
 *
 * 모든 효과는 EffectMap(effects.ts)으로 표현되어 장비와 동일하게 합산된다.
 */

import type { EffectMap } from './effects'
import type { JobId } from './jobs'

export type BuffType = 'item' | 'skill'

/** 스킬 적용 범위: 파티(전 직업) / 개인(특정 직업) */
export type SkillScope = 'party' | 'personal'

/** 스킬 형태: 액티브(켜고 끔) / 패시브(상시) */
export type SkillMode = 'active' | 'passive'

interface BuffBase {
  id: string
  /** 한글 표기 */
  name: string
}

/** 아이템 타입: 전 직업 공용, 고정 효과 */
export interface ItemBuff extends BuffBase {
  type: 'item'
  effects: EffectMap
}

/** 스킬 타입: 레벨별 효과(1 ~ masterLevel) */
export interface SkillBuff extends BuffBase {
  type: 'skill'
  scope: SkillScope
  mode: SkillMode
  /** 마스터(최대) 레벨 — UI 기본 선택 레벨 */
  masterLevel: number
  /** 레벨별 효과. effectsByLevel[lv - 1] = 레벨 lv의 효과 (길이 = masterLevel) */
  effectsByLevel: EffectMap[]
  /** 개인스킬: 사용 가능한 직업 목록. 파티스킬은 생략(전 직업) */
  jobs?: JobId[]
}

export type Buff = ItemBuff | SkillBuff

/** 해당 버프를 선택 직업이 사용할 수 있는지 */
export function canUseBuff(buff: Buff, jobId: JobId): boolean {
  if (buff.type === 'item') return true
  if (buff.scope === 'party') return true
  return buff.jobs?.includes(jobId) ?? false
}

/** UI 기본 선택 레벨 (스킬=마스터레벨, 아이템=1 의미 없음) */
export function defaultBuffLevel(buff: Buff): number {
  return buff.type === 'skill' ? buff.masterLevel : 1
}

/**
 * 지정 레벨에서의 효과를 반환한다.
 *  - item  : 항상 고정 효과(level 무시)
 *  - skill : 레벨 1 ~ masterLevel로 클램프, 0 이하면 효과 없음
 */
export function buffEffectsAtLevel(buff: Buff, level: number): EffectMap {
  if (buff.type === 'item') return buff.effects
  if (level <= 0) return {}
  const lv = Math.min(Math.floor(level), buff.masterLevel)
  return buff.effectsByLevel[lv - 1] ?? {}
}
