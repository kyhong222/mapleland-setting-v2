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
 *
 * 레벨별 수치는 JSON에 적지 않고 스킬북에서 파생한다(derive.ts). 값을 두 벌 유지하면
 * 한쪽만 갱신됐을 때 조용히 어긋나기 때문이다 — 스킬북이 단일 출처다.
 *
 * 주의 — id 중복: ALL_BUFFS 순서상 PERSONAL_BUFFS가 JOB_BUFFS보다 앞이라,
 * 같은 id가 양쪽에 있으면 getBuff()는 personal 쪽을 돌려준다. 과거 바이퍼
 * 트랜스폼/슈퍼트랜스폼이 중복 정의돼 exclusiveGroup이 조용히 무력화된 적 있다.
 * 변신류는 jobSpecific/skills.json에 passive로 두어야 토글 + 배타가 동작한다.
 */

import type { Buff } from '../../domain/buff'
import type { JobId } from '../../domain/jobs'
import { canUseBuff } from '../../domain/buff'
import { resolveBuffs } from './derive'

import enhancementItems from './enhancement/items.json'
import enhancementParty from './enhancement/party.json'
import enhancementPersonal from './enhancement/personal.json'
import commonSkills from './common/skills.json'
import jobSkills from './jobSpecific/skills.json'
import damageBuffs from './jobSpecific/damageBuffs.json'

/** 도핑(아이템 타입) */
export const DOPING_ITEMS = resolveBuffs(enhancementItems)
/**
 * 종료된 이벤트 버프 — JSON 데이터는 그대로 남겨두고 목록에서만 빼놓는다.
 * (JSON은 주석을 달 수 없어 "주석 처리" 대신 이 집합으로 가린다.)
 * 유사 이벤트가 다시 열리면 여기서 id만 지우면 즉시 복구된다.
 *
 *  - 'burning' (버닝 서버 전용 공+10/마+20/이속+10/점프+5): 2026-09-10 버닝 서버 종료.
 *    효과 채널(pad_burning/mad_burning/speed_burning/jump_burning, domain/effects.ts)과
 *    totalAttack()/totalMagic() 합산은 그대로 유지 — 재개 시 이 집합만 건드리면 된다.
 *
 * 저장된 빌드에 id가 남아 있어도 getBuff()가 undefined를 돌려주고
 * activeBuffEffects()가 조용히 건너뛴다(store/aggregate.ts).
 */
const DISABLED_BUFF_IDS: ReadonlySet<string> = new Set(['burning'])

/** 공용 버프 (메이플 용사 등) — 종료된 이벤트 버프 제외 */
export const COMMON_BUFFS = resolveBuffs(commonSkills).filter((b) => !DISABLED_BUFF_IDS.has(b.id))
/** 파티 버프 (샤프아이즈/하이퍼바디/블레스/헤이스트/메디테이션 등) */
export const PARTY_BUFFS = resolveBuffs(enhancementParty)
/** 개인특화 액티브 버프 (아이언바디/포커스/인레이지 등) */
export const PERSONAL_BUFFS = resolveBuffs(enhancementPersonal)
/** 직업 특화 패시브 (+ 자가 데미지증가 버프: 콤보/버서크) */
export const JOB_BUFFS = [...resolveBuffs(jobSkills), ...resolveBuffs(damageBuffs)]

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
