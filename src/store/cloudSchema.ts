/**
 * 클라우드 페이로드 스키마 버전과 마이그레이션. docs/cloud-sync.md §4
 *
 * zustand `persist`의 migrate는 **localStorage 경로에만** 걸린다. 서버에서 받은 payload는
 * applyAll() 앞에서 반드시 여기를 거쳐야 한다 — 안 그러면 구버전 스키마가 검증 없이 들어간다.
 *
 * 버전 올리는 규칙: AppState(=buildStore/inventoryStore의 영속 구조)나 BuildSnapshot이 바뀌면
 * CLOUD_SCHEMA_VERSION을 올리고 아래에 단계를 추가한다. 저장슬롯도 같은 버전을 쓴다.
 *
 * 서버가 이 클라이언트보다 새 버전이면 null을 돌려준다. 오래된 탭이 신버전 데이터를 읽어
 * 모르는 필드를 떨군 채 되쓰는 것을 막기 위해서다.
 */

import type { BuildSnapshot } from './buildStore'
import type { AppState } from './snapshot'

export const CLOUD_SCHEMA_VERSION = 1

const EMPTY_NHIT = { skillId: '' as const, skillLevel: 1, preCast: [] }

/** 서버 payload → AppState. 못 읽는 버전이거나 형태가 깨졌으면 null */
export function migrateCloudState(payload: unknown, from: number): AppState | null {
  if (from > CLOUD_SCHEMA_VERSION) return null
  if (!payload || typeof payload !== 'object') return null

  // v1이 최초 버전이라 아직 변환 단계가 없다.
  // 구조가 바뀌면 여기에 `if (from < 2) { ... }` 식으로 쌓는다.
  const s = payload as Partial<AppState>
  if (!s.build || typeof s.build !== 'object') return null

  return {
    build: s.build,
    inventory: s.inventory ?? [],
    selectedMobId: s.selectedMobId ?? null,
    nhit: s.nhit ?? EMPTY_NHIT,
  }
}

/** 서버 슬롯 snapshot → BuildSnapshot. 직업이 없으면 빈 슬롯으로 친다 */
export function migrateCloudSlot(snapshot: unknown, from: number): BuildSnapshot | null {
  if (from > CLOUD_SCHEMA_VERSION) return null
  if (!snapshot || typeof snapshot !== 'object') return null
  const s = snapshot as Partial<BuildSnapshot>
  return s.jobId ? (s as BuildSnapshot) : null
}
