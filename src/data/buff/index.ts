/**
 * 버프/도핑/스킬 데이터 번들.
 *
 * 디렉토리 구성:
 *  - common/      공용 버프 (메이플 용사 등)
 *  - enhancement/ 파티버프 및 도핑 (items.json=도핑, party.json=파티버프)
 *  - jobSpecific/ 직업 특화 패시브 및 버프 (jobs[]로 사용 직업 명시)
 *
 * 스킬 데이터는 scripts/buildBuffs.mjs가 외부 레포에서 생성한다.
 * 각 JSON은 도메인 Buff(아이템/스킬) 형태(domain/buff.ts).
 */

import type { Buff } from '../../domain/buff'
import type { JobId } from '../../domain/jobs'
import { canUseBuff } from '../../domain/buff'

import enhancementItems from './enhancement/items.json'
import enhancementParty from './enhancement/party.json'
import enhancementPersonal from './enhancement/personal.json'
import commonSkills from './common/skills.json'
import jobSkills from './jobSpecific/skills.json'

/** 도핑(아이템 타입) */
export const DOPING_ITEMS = enhancementItems as unknown as Buff[]
/** 공용 버프 (메이플 용사 등) */
export const COMMON_BUFFS = commonSkills as unknown as Buff[]
/** 파티 버프 (샤프아이즈/하이퍼바디/블레스/헤이스트/메디테이션 등) */
export const PARTY_BUFFS = enhancementParty as unknown as Buff[]
/** 개인특화 액티브 버프 (아이언바디/포커스/인레이지 등) */
export const PERSONAL_BUFFS = enhancementPersonal as unknown as Buff[]
/** 직업 특화 패시브 */
export const JOB_BUFFS = jobSkills as unknown as Buff[]

/** 전체 버프 목록 */
export const ALL_BUFFS: Buff[] = [...COMMON_BUFFS, ...PARTY_BUFFS, ...PERSONAL_BUFFS, ...DOPING_ITEMS, ...JOB_BUFFS]

/** id → Buff 인덱스 */
const BUFF_BY_ID: ReadonlyMap<string, Buff> = new Map(ALL_BUFFS.map((b) => [b.id, b]))

export function getBuff(id: string): Buff | undefined {
  return BUFF_BY_ID.get(id)
}

/** 선택 직업이 사용 가능한 버프 목록 */
export function buffsForJob(jobId: JobId): Buff[] {
  return ALL_BUFFS.filter((b) => canUseBuff(b, jobId))
}
