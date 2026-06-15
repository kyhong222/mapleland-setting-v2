/**
 * 클래스(5종)와 직업(12종) 정의.
 *
 * 클래스 = 전사/마법사/궁수/도적/해적
 * 직업 = 4차 전직 기준 12종. 공격력 공식 입력으로 쓰일 주스탯/부스탯/공격타입을 갖는다.
 * 부스탯은 배열(secondaryStats)이며, 공식에서는 부스탯 값의 합으로 처리한다(도적: [DEX, STR]).
 */

import type { StatId } from './stats'

export type ClassId = 'warrior' | 'magician' | 'bowman' | 'thief' | 'pirate'

export interface ClassDef {
  id: ClassId
  /** 한글 표기 */
  label: string
}

export const CLASSES: Record<ClassId, ClassDef> = {
  warrior: { id: 'warrior', label: '전사' },
  magician: { id: 'magician', label: '마법사' },
  bowman: { id: 'bowman', label: '궁수' },
  thief: { id: 'thief', label: '도적' },
  pirate: { id: 'pirate', label: '해적' },
}

export type JobId =
  | 'hero'
  | 'paladin'
  | 'darkKnight'
  | 'bowmaster'
  | 'marksman'
  | 'archMageIL'
  | 'archMageFP'
  | 'bishop'
  | 'shadower'
  | 'nightLord'
  | 'captain'
  | 'viper'

export type AttackType = 'physical' | 'magical'

export interface JobDef {
  id: JobId
  /** 한글 표기 */
  label: string
  classId: ClassId
  primaryStat: StatId
  /** 부스탯 목록(공식에서는 합으로 처리). 도적은 [DEX, STR] */
  secondaryStats: StatId[]
  attackType: AttackType
}

export const JOBS: Record<JobId, JobDef> = {
  hero: { id: 'hero', label: '히어로', classId: 'warrior', primaryStat: 'STR', secondaryStats: ['DEX'], attackType: 'physical' },
  paladin: { id: 'paladin', label: '팔라딘', classId: 'warrior', primaryStat: 'STR', secondaryStats: ['DEX'], attackType: 'physical' },
  darkKnight: { id: 'darkKnight', label: '다크나이트', classId: 'warrior', primaryStat: 'STR', secondaryStats: ['DEX'], attackType: 'physical' },
  bowmaster: { id: 'bowmaster', label: '보우마스터', classId: 'bowman', primaryStat: 'DEX', secondaryStats: ['STR'], attackType: 'physical' },
  marksman: { id: 'marksman', label: '신궁', classId: 'bowman', primaryStat: 'DEX', secondaryStats: ['STR'], attackType: 'physical' },
  archMageIL: { id: 'archMageIL', label: '아크메이지(썬콜)', classId: 'magician', primaryStat: 'INT', secondaryStats: ['LUK'], attackType: 'magical' },
  archMageFP: { id: 'archMageFP', label: '아크메이지(불독)', classId: 'magician', primaryStat: 'INT', secondaryStats: ['LUK'], attackType: 'magical' },
  bishop: { id: 'bishop', label: '비숍', classId: 'magician', primaryStat: 'INT', secondaryStats: ['LUK'], attackType: 'magical' },
  shadower: { id: 'shadower', label: '섀도어', classId: 'thief', primaryStat: 'LUK', secondaryStats: ['DEX', 'STR'], attackType: 'physical' },
  nightLord: { id: 'nightLord', label: '나이트로드', classId: 'thief', primaryStat: 'LUK', secondaryStats: ['DEX', 'STR'], attackType: 'physical' },
  captain: { id: 'captain', label: '캡틴', classId: 'pirate', primaryStat: 'DEX', secondaryStats: ['STR'], attackType: 'physical' },
  viper: { id: 'viper', label: '바이퍼', classId: 'pirate', primaryStat: 'STR', secondaryStats: ['DEX'], attackType: 'physical' },
}

export const ALL_CLASSES: ClassDef[] = Object.values(CLASSES)
export const ALL_JOBS: JobDef[] = Object.values(JOBS)

/** 특정 클래스에 속한 직업 목록 */
export function jobsOfClass(classId: ClassId): JobDef[] {
  return ALL_JOBS.filter((j) => j.classId === classId)
}
