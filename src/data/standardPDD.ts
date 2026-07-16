/**
 * 직업·레벨별 기준방어력(standardPDD) 테이블.
 * 물리 피격 데미지 공식에서 방어 감소량(B) 분기 기준으로 쓰인다.
 * (출처: v1 mapleland-setting/src/data/buff/standardPDD.json — archer→bowman 키 정리)
 */

import type { ClassId } from '../domain/jobs'
import table from './standardPDD.json'

const STANDARD_PDD = table as Record<ClassId, Record<string, number>>

/** 해당 직업·레벨의 기준방어력 (레벨 이하 가장 가까운 값, 없으면 0) */
export function lookupStandardPDD(classId: ClassId, level: number): number {
  const t = STANDARD_PDD[classId]
  if (!t) return 0
  let result = 0
  for (const lv of Object.keys(t).map(Number).sort((a, b) => a - b)) {
    if (lv <= level) result = t[String(lv)]
    else break
  }
  return result
}
