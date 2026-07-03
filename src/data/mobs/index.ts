/**
 * 몬스터 데이터 번들.
 *
 * mobList.json(목록 메타) + mobWzData.json(전투 수치)을 id 기준으로 병합해
 * 도메인 Monster(domain/monster.ts) 목록으로 노출한다.
 */

import type { Monster } from '../../domain/monster'
import mobList from './mobList.json'
import mobWzData from './mobWzData.json'

interface MobListEntry {
  id: number
  name: string
  koreanName?: string
  level: number
  isBoss?: boolean
  foundAt?: string[]
}

/** 전투 수치(부분) — id 문자열 키 맵 */
type WzEntry = Partial<Omit<Monster, 'id' | 'name' | 'koreanName' | 'isBoss' | 'foundAt'>>

const WZ = mobWzData as unknown as Record<string, WzEntry>

/** 병합된 전체 몬스터 목록 (mobList 순서 유지) */
export const MONSTERS: Monster[] = (mobList as MobListEntry[]).map((m) => {
  const wz = WZ[String(m.id)] ?? {}
  return {
    id: m.id,
    name: m.name,
    koreanName: m.koreanName,
    level: m.level,
    isBoss: m.isBoss,
    foundAt: m.foundAt,
    maxHP: wz.maxHP,
    PADamage: wz.PADamage,
    MADamage: wz.MADamage,
    PDDamage: wz.PDDamage,
    MDDamage: wz.MDDamage,
    acc: wz.acc,
    eva: wz.eva,
    exp: wz.exp,
    elemAttr: wz.elemAttr,
  }
})

/** id → Monster 인덱스 */
const MONSTER_BY_ID: ReadonlyMap<number, Monster> = new Map(MONSTERS.map((m) => [m.id, m]))

export function getMonster(id: number): Monster | undefined {
  return MONSTER_BY_ID.get(id)
}

/** 출현 지역 목록 (첫 등장 순서 유지) */
export const REGIONS: string[] = (() => {
  const seen = new Set<string>()
  const out: string[] = []
  for (const m of MONSTERS) {
    for (const r of m.foundAt ?? []) {
      if (!seen.has(r)) {
        seen.add(r)
        out.push(r)
      }
    }
  }
  return out
})()

/** 전체 레벨 범위 */
export const LEVEL_RANGE: { min: number; max: number } = MONSTERS.reduce(
  (acc, m) => ({ min: Math.min(acc.min, m.level), max: Math.max(acc.max, m.level) }),
  { min: Infinity, max: -Infinity },
)
