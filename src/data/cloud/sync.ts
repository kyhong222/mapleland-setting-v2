/**
 * 동기화 엔진. docs/cloud-sync.md §4
 *
 * 앱 도메인을 모른다 — 캡처/적용을 콜백으로 주입받고 payload는 `unknown`으로만 다룬다.
 * 다음 서비스에서 이 폴더를 그대로 가져다 쓰기 위한 제약이다.
 *
 * 핵심 연산은 결국 둘뿐이고, 로그인 직후 이관(§5)과 저장 중 충돌(§4)이 이 둘을 공유한다:
 *  - takeRemote() : 서버 것을 받아 적용
 *  - keepLocal()  : 이 기기 것으로 서버를 덮음 (병합은 호출부가 로컬을 먼저 바꾼 뒤 이걸 부른다)
 *
 * 평소에는 schedulePush()가 디바운스로 바뀐 행만 올린다.
 */

import {
  deleteSlot,
  fetchSlots,
  fetchState,
  pushSlot,
  pushState,
  type SlotRow,
  type WriteResult,
} from './userData'

export type SyncStatus =
  | 'idle'
  /** 올리는 중 */
  | 'syncing'
  /** 마지막 저장 성공 */
  | 'saved'
  /** 네트워크 없음 — 복귀 시 자동 재시도 */
  | 'offline'
  /** 다른 기기가 먼저 썼다. 사용자가 고를 때까지 push를 멈춘다 */
  | 'conflict'
  | 'error'

export interface SyncSlot {
  idx: number
  name: string | null
  savedAt: string
  snapshot: unknown
}

export interface CloudSyncDeps {
  userId: string
  appId: string
  schemaVersion: number
  captureState: () => unknown
  captureSlots: () => SyncSlot[]
  /**
   * 서버 payload를 앱에 적용. 서버 스키마가 이 클라이언트보다 새거면 false를 돌려준다
   * (구버전 클라이언트가 신버전 데이터를 뭉개지 않게 하려는 장치).
   */
  applyState: (payload: unknown, schemaVersion: number) => boolean
  applySlots: (slots: SlotRow[]) => boolean
  onStatus: (status: SyncStatus, message?: string) => void
  onConflict: () => void
}

export interface CloudSync {
  /** 서버에 이 앱의 데이터가 있는지 — 로그인 직후 이관 분기용(§5) */
  hasRemote: () => Promise<boolean>
  /**
   * 우리가 아는 것보다 서버가 앞섰는지 (탭 복귀 시 확인).
   * true면 충돌로 보고 사용자에게 묻는다 — 조용히 받아오면 이 기기의 미저장 변경이 날아간다.
   */
  checkRemoteAhead: () => Promise<void>
  takeRemote: () => Promise<void>
  keepLocal: () => Promise<void>
  /** 변경 알림 — 디바운스 후 바뀐 행만 올린다 */
  schedulePush: () => void
  /** 디바운스를 건너뛰고 지금 올린다 (탭을 떠날 때 등) */
  flush: () => Promise<void>
  dispose: () => void
}

/** 변경이 멎고 이만큼 지나면 올린다 */
const DEBOUNCE_MS = 2000

/** 스키마가 너무 새거나 네트워크가 죽었을 때 사용자에게 보여줄 문구 */
const MSG_TOO_NEW = '다른 기기에서 더 새 버전으로 저장했습니다. 페이지를 새로고침해 주세요.'

export function createCloudSync(deps: CloudSyncDeps): CloudSync {
  const { userId, appId, schemaVersion } = deps

  /** 마지막으로 읽은 rev. null = 서버에 행이 없음 */
  let stateRev: number | null = null
  let slotRevs = new Map<number, number>()
  /** 마지막으로 올린 내용(JSON) — 이것과 같으면 올리지 않는다 */
  let lastState: string | null = null
  let lastSlots = new Map<number, string>()

  /** 충돌 상태에서는 사용자가 고를 때까지 아무것도 올리지 않는다 */
  let paused = false
  let timer: ReturnType<typeof setTimeout> | null = null
  /** 동시에 두 번 올리지 않도록 직렬화 */
  let running: Promise<void> = Promise.resolve()
  let disposed = false

  const status = (s: SyncStatus, message?: string) => {
    if (!disposed) deps.onStatus(s, message)
  }

  /** 네트워크 문제와 진짜 오류를 가른다 — 오프라인은 복귀 시 자동 재시도 대상이다 */
  function reportFailure(e: unknown): void {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      status('offline')
      return
    }
    status('error', e instanceof Error ? e.message : String(e))
  }

  function enterConflict(): void {
    paused = true
    status('conflict')
    deps.onConflict()
  }

  /** 쓰기 결과 공통 처리. 계속 진행해도 되면 true */
  function handleWrite(r: WriteResult): r is { ok: true; rev: number } {
    if (r.ok) return true
    if (r.reason === 'conflict') enterConflict()
    else status('error', r.message)
    return false
  }

  /** 서버의 현재 rev만 다시 읽는다 (내용은 버린다) — 덮어쓰기 전에 필요하다 */
  async function refreshRevs(): Promise<void> {
    const [row, slots] = await Promise.all([fetchState(userId, appId), fetchSlots(userId, appId)])
    stateRev = row?.rev ?? null
    slotRevs = new Map(slots.map((s) => [s.idx, s.rev]))
  }

  /** 방금 적용/전송한 내용을 "서버와 같음"으로 표시해 불필요한 push를 막는다 */
  function markBaseline(): void {
    lastState = JSON.stringify(deps.captureState())
    lastSlots = new Map(deps.captureSlots().map((s) => [s.idx, JSON.stringify(s)]))
  }

  async function pushChanged(all: boolean): Promise<void> {
    if (paused) return
    status('syncing')

    const payload = deps.captureState()
    const json = JSON.stringify(payload)
    if (all || json !== lastState) {
      const r = await pushState(userId, appId, payload, schemaVersion, stateRev)
      if (!handleWrite(r)) return
      stateRev = r.rev
      lastState = json
    }

    const slots = deps.captureSlots()
    const present = new Set<number>()
    for (const slot of slots) {
      present.add(slot.idx)
      const j = JSON.stringify(slot)
      if (!all && j === lastSlots.get(slot.idx)) continue
      const r = await pushSlot(userId, appId, slot, schemaVersion, slotRevs.get(slot.idx) ?? null)
      if (!handleWrite(r)) return
      slotRevs.set(slot.idx, r.rev)
      lastSlots.set(slot.idx, j)
    }

    // 로컬에서 비운 슬롯은 서버에서도 지운다. all이면 서버에만 있는 칸까지 훑어야 한다
    const known = all ? new Set([...slotRevs.keys(), ...lastSlots.keys()]) : new Set(lastSlots.keys())
    for (const idx of known) {
      if (present.has(idx)) continue
      await deleteSlot(userId, appId, idx)
      lastSlots.delete(idx)
      slotRevs.delete(idx)
    }

    status('saved')
  }

  /** 모든 네트워크 작업을 한 줄로 세운다 — 겹쳐 돌면 rev가 엇갈린다 */
  function serialize(task: () => Promise<void>): Promise<void> {
    running = running.then(task, task).catch(reportFailure)
    return running
  }

  const flush = (): Promise<void> => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    return serialize(() => pushChanged(false))
  }

  function onOnline(): void {
    // 오프라인 동안 밀린 변경을 올린다
    void flush()
  }
  if (typeof window !== 'undefined') window.addEventListener('online', onOnline)

  return {
    hasRemote: async () => {
      const [row, slots] = await Promise.all([fetchState(userId, appId), fetchSlots(userId, appId)])
      stateRev = row?.rev ?? null
      slotRevs = new Map(slots.map((s) => [s.idx, s.rev]))
      return row !== null || slots.length > 0
    },

    checkRemoteAhead: () =>
      serialize(async () => {
        if (paused) return
        const [row, slots] = await Promise.all([fetchState(userId, appId), fetchSlots(userId, appId)])
        const ahead =
          (row?.rev ?? null) !== stateRev ||
          slots.length !== slotRevs.size ||
          slots.some((s) => slotRevs.get(s.idx) !== s.rev)
        if (ahead) enterConflict()
      }),

    takeRemote: () =>
      serialize(async () => {
        const [row, slots] = await Promise.all([fetchState(userId, appId), fetchSlots(userId, appId)])
        // 서버가 더 새 스키마다. rev는 최신이라 그대로 두면 이 낡은 클라이언트의 push가
        // **성공해서** 신버전 데이터를 뭉갠다 — 멈춰 세워야 한다.
        if ((row && !deps.applyState(row.payload, row.schemaVersion)) || !deps.applySlots(slots)) {
          paused = true
          status('error', MSG_TOO_NEW)
          return
        }
        stateRev = row?.rev ?? null
        slotRevs = new Map(slots.map((s) => [s.idx, s.rev]))
        markBaseline()
        paused = false
        status('saved')
      }),

    keepLocal: () =>
      serialize(async () => {
        // 덮어쓰려면 서버의 현재 rev를 알아야 한다 — 충돌 직후엔 우리가 아는 값이 낡았다
        await refreshRevs()
        paused = false
        await pushChanged(true)
      }),

    schedulePush: () => {
      if (paused || disposed) return
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = null
        void serialize(() => pushChanged(false))
      }, DEBOUNCE_MS)
    },

    flush,

    dispose: () => {
      disposed = true
      if (timer) clearTimeout(timer)
      timer = null
      if (typeof window !== 'undefined') window.removeEventListener('online', onOnline)
    },
  }
}
