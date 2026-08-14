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
import { JOBS } from './jobs'
import type { WeaponType } from './weapons'

export type BuffType = 'item' | 'skill'

/** 스킬 적용 범위: 파티(전 직업) / 개인(특정 직업) */
export type SkillScope = 'party' | 'personal'

/** 스킬 형태: 액티브(켜고 끔) / 패시브(상시) */
export type SkillMode = 'active' | 'passive'

interface BuffBase {
  id: string
  /** 한글 표기 */
  name: string
  /** 아이콘 (스킬=base64 data URI, 아이템=미지정 시 id로 URL 유도) */
  icon?: string
  /**
   * 캡션 보조 안내문. 효과가 있으면 효과 뒤에 덧붙고(예: '스턴 상황 가정'),
   * 효과가 비어 있으면 효과 대신 단독 표시된다(예: 미구현 스킬 표기).
   */
  note?: string
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
  /** 무기 숙련도/엑스퍼트: 적용되는 무기 타입. 장착 주무기가 일치할 때만 자동 적용 */
  weaponTypes?: WeaponType[]
  /**
   * 변형 선택(레벨 슬라이더 대신 라디오). 있으면 레벨 = 변형 인덱스+1,
   * effectsByLevel[i]가 각 변형(예: 영웅의 메아리 모험가/시그너스)의 효과.
   */
  variants?: string[]
  /** 선행 버프 id — 이 버프가 off면 본 버프도 off로 취급(표시/효과). 예: 어드밴스드콤보 → 콤보어택 */
  requires?: string
  /** 방패 착용 필요 — 보조무기 슬롯에 방패가 없으면 off로 취급(표시/효과). 예: 블로킹 */
  requiresShield?: boolean
  /**
   * 배타 그룹 — 같은 그룹의 버프는 동시에 하나만 켤 수 있다(라디오처럼).
   * 예: 해적 트랜스폼/슈퍼트랜스폼. (에너지 차지는 변신과 독립이라 그룹에 없다)
   */
  exclusiveGroup?: string
}

export type Buff = ItemBuff | SkillBuff

/** 해당 버프를 선택 직업이 사용할 수 있는지 */
export function canUseBuff(buff: Buff, jobId: JobId): boolean {
  if (buff.type === 'item') return true
  if (buff.scope === 'party') return true
  return buff.jobs?.includes(jobId) ?? false
}

/**
 * 직업 조건부 마스터레벨.
 *  - 정령의 축복(blessingOfFairy): 모험가 12 / 시그너스 20
 *  - 그 외: 스킬=masterLevel, 아이템=1
 */
export function effectiveMasterLevel(buff: Buff, jobId: JobId | null): number {
  if (buff.id === 'blessingOfFairy') return jobId && JOBS[jobId].order === 'cygnus' ? 20 : 12
  return buff.type === 'skill' ? buff.masterLevel : 1
}

/** UI 기본 선택 레벨 (변형 버프=첫 변형, 스킬=마스터레벨, 아이템=1 의미 없음) */
export function defaultBuffLevel(buff: Buff, jobId: JobId | null = null): number {
  if (buff.type !== 'skill') return 1
  if (buff.variants) return 1
  return effectiveMasterLevel(buff, jobId)
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
