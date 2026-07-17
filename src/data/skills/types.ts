/**
 * 스킬 데이터 타입 (ms-skill-simulator 포트).
 * base64 아이콘·soundPath는 제외했고, 레벨별 수치는 levelProperties(동적 키)로 유지한다.
 */

export interface IJob {
  id: number
  name: string
  koname?: string
}

/** 레벨별 속성. hs("h10")가 레벨 식별자, 나머지는 동적 수치(문자열). */
export interface ILevelProperties {
  hs: string
  [key: string]: string
}

export interface ISkillDescription {
  id: number
  name: string
  desc?: string
  bookName?: string
  detail?: string
}

export interface IJobSkill {
  id: number
  masterLevel: number
  /** 사용 가능 무기 종류 (아이콘은 public/skill-icons/<id>.png 로 분리) */
  weapons: string[]
  /** 스킬 액션 키 */
  actions?: string[]
  /** 속성(불/얼음/번개/독/성 등) */
  elementalAttribute?: string
  description?: ISkillDescription
  /** 레벨별 수치 (hs로 레벨 파싱) */
  levelProperties: ILevelProperties[]
  /** 선행 스킬 요구 레벨 (스킬id → 레벨) */
  requiredSkillLevels?: Record<string, number>
  invisible?: boolean
}

export interface IJobSkillBookDescription {
  id: number
  name: string
  desc?: string
  shortDesc?: string
  bookName?: string
}

export interface IJobSkillBook {
  id: number
  job: IJob
  description: IJobSkillBookDescription
  skills: IJobSkill[]
}
