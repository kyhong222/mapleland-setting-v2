/**
 * 피격 데미지(캐릭터가 몬스터에게 받는 데미지) 계산.
 *
 * 출처: v1 mapleland-setting/src/components/DamageReceivedTable.tsx (해외 검증식).
 * Phase A: 물리 접촉 + 마법 피격 데미지 + 파워업/매직업 배율.
 * (메소가드·속성저항·파워가드 등 특수스킬 감소는 스킬 데이터 확정 후 Phase B.)
 */

import type { BaseStats } from './stats'
import type { MobSkill } from './monster'

export interface IncomingRange {
  min: number
  max: number
}

/** 파워업/매직업 배율 (일반 1.15 / 보스 1.3) */
export const POWER_UP_NORMAL = 1.15
export const POWER_UP_BOSS = 1.3

/**
 * 물리 접촉/물리스킬 피격 데미지.
 *   C(전사) = STR/2800 + DEX/3200 + INT/7200 + LUK/3200
 *   C(그외) = STR/2000 + DEX/2800 + INT/7200 + LUK/3200
 *   A = C + 0.28
 *   t = 몬스터ATT² × rand(0.008 ~ 0.0085)
 *   D(캐릭Lv≥몬Lv) = 13/(13+캐릭Lv−몬Lv), D(캐릭Lv<몬Lv) = 1.3
 *   B(PDD≥stdPDD) = C×28/45 + 캐릭Lv×7/13000 + 0.196
 *   B(PDD<stdPDD) = D×(C + 캐릭Lv/550 + 0.28)
 *   damage = max(1, floor(t − PDD×A − (PDD−stdPDD)×B))
 */
export function physicalIncoming(p: {
  monsterAtt: number
  charLevel: number
  monLevel: number
  /** 캐릭터 물리방어력 */
  pdd: number
  /** 직업·레벨 기준방어력 */
  stdPdd: number
  isWarrior: boolean
  /** 최종 능력치 */
  stats: BaseStats
}): IncomingRange {
  const { monsterAtt, charLevel, monLevel, pdd, stdPdd, isWarrior, stats } = p
  const C = isWarrior
    ? stats.STR / 2800 + stats.DEX / 3200 + stats.INT / 7200 + stats.LUK / 3200
    : stats.STR / 2000 + stats.DEX / 2800 + stats.INT / 7200 + stats.LUK / 3200
  const A = C + 0.28

  let B: number
  if (pdd >= stdPdd) {
    B = (C * 28) / 45 + (charLevel * 7) / 13000 + 0.196
  } else {
    const D = charLevel >= monLevel ? 13 / (13 + charLevel - monLevel) : 1.3
    B = D * (C + charLevel / 550 + 0.28)
  }

  const tMin = monsterAtt * monsterAtt * 0.008
  const tMax = monsterAtt * monsterAtt * 0.0085
  const reduction = pdd * A + (pdd - stdPdd) * B
  return {
    min: Math.max(1, Math.floor(tMin - reduction)),
    max: Math.max(1, Math.floor(tMax - reduction)),
  }
}

/**
 * 마법 피격 데미지.
 *   t = 몬스터MATT² × rand(0.0075 ~ 0.008)
 *   defense = (MDD/4 + STR/28 + DEX/24 + LUK/20) × K,  K = 1.2(마법사) / 1.0(그외)
 *   damage = max(1, floor(t − defense))
 */
export function magicIncoming(p: {
  monsterMatt: number
  /** 캐릭터 마법방어력 */
  mdd: number
  isMagician: boolean
  stats: BaseStats
}): IncomingRange {
  const { monsterMatt, mdd, isMagician, stats } = p
  const K = isMagician ? 1.2 : 1.0
  const defense = (mdd / 4 + stats.STR / 28 + stats.DEX / 24 + stats.LUK / 20) * K
  const tMin = monsterMatt * monsterMatt * 0.0075
  const tMax = monsterMatt * monsterMatt * 0.008
  return {
    min: Math.max(1, Math.floor(tMin - defense)),
    max: Math.max(1, Math.floor(tMax - defense)),
  }
}

/** 파워업/매직업 배율 적용 (일반 1.15 / 보스 1.3), 최소 1 유지. */
export function applyPowerUp(range: IncomingRange, enabled: boolean, isBoss: boolean): IncomingRange {
  if (!enabled) return range
  const m = isBoss ? POWER_UP_BOSS : POWER_UP_NORMAL
  return {
    min: Math.max(1, Math.floor(range.min * m)),
    max: Math.max(1, Math.floor(range.max * m)),
  }
}

const ELEM_LABEL: Record<string, string> = { F: '불', I: '얼음', L: '번개', S: '독', H: '성' }

/** 스킬 표시 라벨 ("번개속성 마법", "불속성 물리", "물리" 등) */
function skillLabel(skill: MobSkill): string {
  if (skill.magic === 1) {
    const e = skill.elemAttr ? ELEM_LABEL[skill.elemAttr] ?? skill.elemAttr : '무'
    return `${e}속성 마법`
  }
  const e = skill.elemAttr ? `${ELEM_LABEL[skill.elemAttr] ?? skill.elemAttr}속성 ` : ''
  return `${e}물리`
}

/** 몬스터 스킬 한 개의 피격 데미지 */
export interface SkillIncoming {
  /** 스킬 키(attack1 등) — render 애니메이션 이름 */
  key: string
  label: string
  isMagic: boolean
  range: IncomingRange
}

/**
 * 몬스터 스킬별 피격 데미지 목록.
 *  - 마법 스킬(magic===1): 몬스터 MADamage로 마법 피격 계산
 *  - 물리 스킬(PADamage 보유): 스킬 자체 PADamage로 물리 피격 계산
 *  - 그 외(비데미지 스킬): 제외
 */
export function monsterSkillIncoming(p: {
  skills: Record<string, MobSkill>
  monsterMatt: number
  charLevel: number
  monLevel: number
  pdd: number
  stdPdd: number
  mdd: number
  isWarrior: boolean
  isMagician: boolean
  stats: BaseStats
}): SkillIncoming[] {
  const out: SkillIncoming[] = []
  for (const [key, sk] of Object.entries(p.skills)) {
    if (sk.magic === 1) {
      out.push({
        key,
        label: skillLabel(sk),
        isMagic: true,
        range: magicIncoming({ monsterMatt: p.monsterMatt, mdd: p.mdd, isMagician: p.isMagician, stats: p.stats }),
      })
    } else if (sk.PADamage) {
      out.push({
        key,
        label: skillLabel(sk),
        isMagic: false,
        range: physicalIncoming({
          monsterAtt: sk.PADamage,
          charLevel: p.charLevel,
          monLevel: p.monLevel,
          pdd: p.pdd,
          stdPdd: p.stdPdd,
          isWarrior: p.isWarrior,
          stats: p.stats,
        }),
      })
    }
  }
  return out
}
