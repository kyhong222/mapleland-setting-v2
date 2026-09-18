/**
 * 동기화 기동/중단 + 화면용 상태. docs/cloud-sync.md §4·§5·§6
 *
 * 스토어를 직접 건드리지 않는다 — 캡처/적용은 전부 `snapshot.ts`를 거친다(스토어 조립은
 * 거기서만 한다는 규칙). 로그인 상태와의 연결은 `CloudSyncGate` 컴포넌트가 한다.
 *
 * 구독 시점이 중요하다: 이관 분기가 끝나기 **전에** 스토어를 구독하면, 계정 데이터를 적용하는
 * 동안이나 사용자가 고르기도 전에 로컬 상태가 서버로 올라가 계정 데이터를 덮는다.
 * 그래서 `beginPushing()`은 항상 분기가 끝난 뒤에 부른다.
 */

import { create } from 'zustand'
import { createCloudSync, type CloudSync, type SyncStatus } from '../data/cloud/sync'
import { APP_ID } from '../data/cloud/supabase'
import {
  applyAll,
  applySlotRows,
  captureAll,
  captureSlotRows,
  hasLocalData,
  restoreGuest,
  saveGuestBundle,
  subscribeAll,
} from './snapshot'
import { CLOUD_SCHEMA_VERSION, migrateCloudState } from './cloudSchema'

/** 사용자에게 물어야 하는 상황 */
export type CloudPrompt =
  | null
  /** 계정이 비어 있다 — 이 기기 세팅을 계정으로 올릴지 묻는다(§5) */
  | 'upload'
  /** 저장 중: 다른 기기가 먼저 썼다(§4) */
  | 'conflict'

interface CloudSyncState {
  status: SyncStatus
  message: string | null
  prompt: CloudPrompt
  /**
   * 자동 동기화가 돌고 있는지. 계정이 빈 상태에서 '나중에'를 고르면 false로 남는다 —
   * 올릴지 말지 답을 안 한 기기를 조용히 올려버리지 않기 위해서다.
   */
  autoSync: boolean
  /** 선택 처리 중 — 다이얼로그 버튼을 잠근다 */
  busy: boolean
  /** 계정 것을 받는다 (이 기기 내용은 덮인다) */
  takeRemote: () => Promise<void>
  /** 이 기기 것으로 계정을 덮는다 */
  keepLocal: () => Promise<void>
  /** '나중에' — 이관하지 않고 동기화도 시작하지 않는다 */
  postpone: () => void
}

let engine: CloudSync | null = null
let unsubStores: (() => void) | null = null
let onVisibility: (() => void) | null = null
let onPageHide: (() => void) | null = null

const setState = (patch: Partial<CloudSyncState>) => useCloudSyncStore.setState(patch)

/** 분기가 끝난 뒤에만 부른다 (파일 상단 주석 참고) */
function beginPushing(): void {
  if (!engine || unsubStores) return
  setState({ autoSync: true })
  unsubStores = subscribeAll(() => engine?.schedulePush())

  onVisibility = () => {
    if (document.visibilityState === 'visible') void engine?.checkRemoteAhead()
    else void engine?.flush()
  }
  document.addEventListener('visibilitychange', onVisibility)

  // 탭을 닫을 때 디바운스 대기 중인 변경을 흘려보낸다
  onPageHide = () => void engine?.flush()
  window.addEventListener('pagehide', onPageHide)
}

async function resolve(action: (e: CloudSync) => Promise<void>): Promise<void> {
  if (!engine) return
  setState({ busy: true })
  try {
    await action(engine)
  } finally {
    setState({ busy: false, prompt: null })
    beginPushing()
  }
}

export const useCloudSyncStore = create<CloudSyncState>()(() => ({
  status: 'idle',
  message: null,
  prompt: null,
  autoSync: false,
  busy: false,

  takeRemote: () => resolve((e) => e.takeRemote()),
  keepLocal: () => resolve((e) => e.keepLocal()),

  postpone: () => setState({ prompt: null }),
}))

/**
 * 로그인 직후 기동. docs/cloud-sync.md §5의 네 갈래를 여기서 가른다.
 * 이미 돌고 있으면 아무것도 하지 않는다.
 */
export async function startCloudSync(userId: string): Promise<void> {
  if (engine) return

  const mine = createCloudSync({
    userId,
    appId: APP_ID,
    schemaVersion: CLOUD_SCHEMA_VERSION,
    captureState: () => captureAll(),
    captureSlots: () => captureSlotRows(),
    applyState: (payload, version) => {
      const state = migrateCloudState(payload, version)
      if (!state) return false
      applyAll(state)
      return true
    },
    applySlots: (rows) => applySlotRows(rows),
    onStatus: (status, message) => setState({ status, message: message ?? null }),
    onConflict: () => setState({ prompt: 'conflict' }),
  })
  engine = mine

  /**
   * 아래는 await를 끼고 있어, 그 사이에 로그아웃/재마운트로 stopCloudSync가 돌 수 있다
   * (개발 모드 StrictMode의 effect 2회 실행 포함). 그때 이어서 진행하면 이미 버려진
   * 엔진으로 네트워크를 때리거나 null을 참조한다.
   */
  const stale = () => engine !== mine

  const hadLocal = hasLocalData()
  // 계정 화면으로 넘어가기 전에 이 기기(게스트) 벌을 옮겨 둔다. 로그아웃하면 여기서 되돌린다.
  // 이미 있으면 덮지 않으므로, 로그인 상태로 새로고침해도 게스트 벌은 그대로다.
  saveGuestBundle()

  let hasRemote = false
  try {
    hasRemote = await mine.hasRemote()
  } catch (e) {
    if (stale()) return
    setState({ status: 'error', message: e instanceof Error ? e.message : '계정 데이터를 읽지 못했습니다.' })
    return // 서버 상태를 모르면 올리지 않는다 — 덮어쓸 위험이 있다
  }
  if (stale()) return

  if (hasRemote) {
    await mine.takeRemote()
  } else if (hadLocal) {
    // 계정이 비어 있다 = 아직 한 번도 올린 적 없다. 올릴지 물어본다.
    setState({ prompt: 'upload' }) // 고를 때까지 구독하지 않는다
    return
  }
  if (stale()) return
  beginPushing()
}

/**
 * 로그아웃 — 동기화를 멈추고, 이 기기에 남은 계정 데이터를 지운 뒤 게스트 벌로 되돌린다.
 *
 * **언마운트(탭 닫기)에서는 부르면 안 된다.** 되돌리기까지 하므로 `stopCloudSync`와 구분한다.
 * 멈추는 게 먼저다 — 순서가 바뀌면 게스트 데이터가 계정으로 올라간다.
 */
export function signOutCleanup(): void {
  stopCloudSync()
  restoreGuest()
}

/** 동기화만 멈춘다 (언마운트 등). 화면의 데이터는 건드리지 않는다 */
export function stopCloudSync(): void {
  unsubStores?.()
  unsubStores = null
  if (onVisibility) document.removeEventListener('visibilitychange', onVisibility)
  onVisibility = null
  if (onPageHide) window.removeEventListener('pagehide', onPageHide)
  onPageHide = null
  engine?.dispose()
  engine = null
  setState({ status: 'idle', message: null, prompt: null, autoSync: false, busy: false })
}
