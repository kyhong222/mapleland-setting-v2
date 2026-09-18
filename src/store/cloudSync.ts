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
  captureBundle,
  captureSlotRows,
  hasLocalData,
  mergeLocalInto,
  saveLocalBackup,
  subscribeAll,
  type LocalBundle,
  type MergeResult,
} from './snapshot'
import { CLOUD_SCHEMA_VERSION, migrateCloudState } from './cloudSchema'

/** 사용자에게 물어야 하는 상황 */
export type CloudPrompt =
  | null
  /** 로그인 직후: 이 기기에도, 계정에도 데이터가 있다(§5) */
  | 'migrate'
  /** 저장 중: 다른 기기가 먼저 썼다(§4) */
  | 'conflict'

interface CloudSyncState {
  status: SyncStatus
  message: string | null
  prompt: CloudPrompt
  /** 병합 직후 결과 안내 (읽고 나면 dismissMerge로 지운다) */
  merge: MergeResult | null
  /** 선택 처리 중 — 다이얼로그 버튼을 잠근다 */
  busy: boolean
  takeRemote: () => Promise<void>
  keepLocal: () => Promise<void>
  mergeBoth: () => Promise<void>
  dismissMerge: () => void
}

let engine: CloudSync | null = null
let unsubStores: (() => void) | null = null
let onVisibility: (() => void) | null = null
let onPageHide: (() => void) | null = null
/** 로그인 시점의 이 기기 상태 — 병합 입력으로 쓴다 */
let localAtLogin: LocalBundle | null = null

const setState = (patch: Partial<CloudSyncState>) => useCloudSyncStore.setState(patch)

/** 분기가 끝난 뒤에만 부른다 (파일 상단 주석 참고) */
function beginPushing(): void {
  if (!engine || unsubStores) return
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

async function resolve(action: (e: CloudSync) => Promise<void>, backup: boolean): Promise<void> {
  if (!engine) return
  setState({ busy: true })
  try {
    if (backup) saveLocalBackup()
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
  merge: null,
  busy: false,

  // 로컬이 덮이므로 백업을 남긴다
  takeRemote: () => resolve((e) => e.takeRemote(), true),

  // 서버만 덮인다 — 로컬은 그대로라 백업이 필요 없다
  keepLocal: () => resolve((e) => e.keepLocal(), false),

  mergeBoth: () =>
    resolve(async (e) => {
      const local = localAtLogin ?? captureBundle()
      await e.takeRemote()
      const merge = mergeLocalInto(local)
      await e.keepLocal()
      setState({ merge })
    }, true),

  dismissMerge: () => setState({ merge: null }),
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
  localAtLogin = hadLocal ? captureBundle() : null

  let hasRemote = false
  try {
    hasRemote = await mine.hasRemote()
  } catch (e) {
    if (stale()) return
    setState({ status: 'error', message: e instanceof Error ? e.message : '계정 데이터를 읽지 못했습니다.' })
    return // 서버 상태를 모르면 올리지 않는다 — 덮어쓸 위험이 있다
  }
  if (stale()) return

  if (hadLocal && hasRemote) {
    setState({ prompt: 'migrate' }) // 사용자가 고를 때까지 구독하지 않는다
    return
  }
  if (hadLocal) {
    await mine.keepLocal() // 계정이 비어 있다 — 그냥 올린다
  } else if (hasRemote) {
    await mine.takeRemote()
  }
  if (stale()) return
  beginPushing()
}

/** 로그아웃/언마운트. 로컬 데이터는 그대로 두고 동기화만 멈춘다 */
export function stopCloudSync(): void {
  unsubStores?.()
  unsubStores = null
  if (onVisibility) document.removeEventListener('visibilitychange', onVisibility)
  onVisibility = null
  if (onPageHide) window.removeEventListener('pagehide', onPageHide)
  onPageHide = null
  engine?.dispose()
  engine = null
  localAtLogin = null
  setState({ status: 'idle', message: null, prompt: null, merge: null, busy: false })
}
