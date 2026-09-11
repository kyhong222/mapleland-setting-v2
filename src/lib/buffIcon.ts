import type { Buff } from '../domain/buff'
import type { JobId } from '../domain/jobs'

/**
 * 버프 아이콘 URL. 스킬=아이콘 경로, 아이템=id로 아이콘 URL 유도.
 * 같은 스킬이라도 직업에 따라 아이콘이 다른 경우(시그너스 분노 등) iconByJob이 우선한다.
 */
export function buffIconUrl(buff: Buff, jobId: JobId | null): string | undefined {
  if (buff.type === 'skill' && jobId && buff.iconByJob?.[jobId]) return buff.iconByJob[jobId]
  if (buff.icon) return buff.icon
  if (buff.type === 'item') return `https://maplestory.io/api/gms/62/item/${buff.id}/icon`
  return undefined
}
