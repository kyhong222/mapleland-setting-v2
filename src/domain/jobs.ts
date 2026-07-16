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
  // 시그너스 기사단
  | 'soulMaster'
  | 'flameWizard'
  | 'windBreaker'
  | 'nightWalker'
  | 'striker'

export type AttackType = 'physical' | 'magical'

/** 직업 계열: 모험가(explorer) / 시그너스 기사단(cygnus) */
export type JobOrder = 'explorer' | 'cygnus'

export interface JobDef {
  id: JobId
  /** 한글 표기 */
  label: string
  classId: ClassId
  /** 직업 계열 (AP·최대레벨 등이 계열별로 다름) */
  order: JobOrder
  primaryStat: StatId
  /** 부스탯 목록(공식에서는 합으로 처리). 도적은 [DEX, STR] */
  secondaryStats: StatId[]
  attackType: AttackType
}

export const JOBS: Record<JobId, JobDef> = {
  hero: { id: 'hero', label: '히어로', classId: 'warrior', order: 'explorer', primaryStat: 'STR', secondaryStats: ['DEX'], attackType: 'physical' },
  paladin: { id: 'paladin', label: '팔라딘', classId: 'warrior', order: 'explorer', primaryStat: 'STR', secondaryStats: ['DEX'], attackType: 'physical' },
  darkKnight: { id: 'darkKnight', label: '다크나이트', classId: 'warrior', order: 'explorer', primaryStat: 'STR', secondaryStats: ['DEX'], attackType: 'physical' },
  bowmaster: { id: 'bowmaster', label: '보우마스터', classId: 'bowman', order: 'explorer', primaryStat: 'DEX', secondaryStats: ['STR'], attackType: 'physical' },
  marksman: { id: 'marksman', label: '신궁', classId: 'bowman', order: 'explorer', primaryStat: 'DEX', secondaryStats: ['STR'], attackType: 'physical' },
  archMageIL: { id: 'archMageIL', label: '아크메이지(썬콜)', classId: 'magician', order: 'explorer', primaryStat: 'INT', secondaryStats: ['LUK'], attackType: 'magical' },
  archMageFP: { id: 'archMageFP', label: '아크메이지(불독)', classId: 'magician', order: 'explorer', primaryStat: 'INT', secondaryStats: ['LUK'], attackType: 'magical' },
  bishop: { id: 'bishop', label: '비숍', classId: 'magician', order: 'explorer', primaryStat: 'INT', secondaryStats: ['LUK'], attackType: 'magical' },
  shadower: { id: 'shadower', label: '섀도어', classId: 'thief', order: 'explorer', primaryStat: 'LUK', secondaryStats: ['DEX', 'STR'], attackType: 'physical' },
  nightLord: { id: 'nightLord', label: '나이트로드', classId: 'thief', order: 'explorer', primaryStat: 'LUK', secondaryStats: ['DEX', 'STR'], attackType: 'physical' },
  captain: { id: 'captain', label: '캡틴', classId: 'pirate', order: 'explorer', primaryStat: 'DEX', secondaryStats: ['STR'], attackType: 'physical' },
  viper: { id: 'viper', label: '바이퍼', classId: 'pirate', order: 'explorer', primaryStat: 'STR', secondaryStats: ['DEX'], attackType: 'physical' },

  // ── 시그너스 기사단 (각 클래스 대응, 최대레벨 120) ──
  soulMaster: { id: 'soulMaster', label: '소울마스터', classId: 'warrior', order: 'cygnus', primaryStat: 'STR', secondaryStats: ['DEX'], attackType: 'physical' },
  flameWizard: { id: 'flameWizard', label: '플레임위자드', classId: 'magician', order: 'cygnus', primaryStat: 'INT', secondaryStats: ['LUK'], attackType: 'magical' },
  windBreaker: { id: 'windBreaker', label: '윈드브레이커', classId: 'bowman', order: 'cygnus', primaryStat: 'DEX', secondaryStats: ['STR'], attackType: 'physical' },
  nightWalker: { id: 'nightWalker', label: '나이트워커', classId: 'thief', order: 'cygnus', primaryStat: 'LUK', secondaryStats: ['DEX', 'STR'], attackType: 'physical' },
  striker: { id: 'striker', label: '스트라이커', classId: 'pirate', order: 'cygnus', primaryStat: 'STR', secondaryStats: ['DEX'], attackType: 'physical' },
}

export const ALL_CLASSES: ClassDef[] = Object.values(CLASSES)
export const ALL_JOBS: JobDef[] = Object.values(JOBS)

/** 직업 계열 표기 */
export const JOB_ORDER_LABELS: Record<JobOrder, string> = {
  explorer: '모험가',
  cygnus: '시그너스 기사단',
}

/** 특정 클래스에 속한 직업 목록 (order 지정 시 계열로 추가 필터) */
export function jobsOfClass(classId: ClassId, order?: JobOrder): JobDef[] {
  return ALL_JOBS.filter((j) => j.classId === classId && (order === undefined || j.order === order))
}
