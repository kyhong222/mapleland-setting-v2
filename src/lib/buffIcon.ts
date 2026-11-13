import type { Buff } from '../domain/buff'
import type { JobId } from '../domain/jobs'
import type { ChargeElement } from '../domain/paladinCharge'

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

/** 팔라딘 차지 원소 → 버프 아이콘(검 대표) */
export const CHARGE_ICON: Record<ChargeElement, string> = {
  fire: '/buff-icons/1211003.png',
  ice: '/buff-icons/1211005.png',
  lightning: '/buff-icons/1211007.png',
  holy: '/buff-icons/1221003.png',
}
