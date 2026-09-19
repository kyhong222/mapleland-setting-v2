/**
 * 저장슬롯 캡처/복원 — 여러 스토어에 흩어진 상태를 하나의 BuildSnapshot으로 묶는다.
 *
 * 슬롯을 따라다니는 것: 빌드(직업·레벨·스탯·장착·버프·차지) + 대상 몬스터 +
 * n방컷 스킬 선택 + 개인 인벤토리.
 * 슬롯과 무관하게 남는 것: 공용 인벤토리.
 *
 * 스토어끼리 서로 import하지 않도록 조립은 여기서만 한다(SlotManager가 이 함수만 쓴다).
 */

import { useBuildStore } from './buildStore'
import type { BuildPersisted, BuildSnapshot } from './buildStore'
import { useMonsterStore } from './monsterStore'
import { useNhitStore } from './nhitStore'
import type { NhitSelection } from './nhitStore'
import { useInventoryStore, ownerOf } from './inventoryStore'
import type { InventoryItem } from './inventoryStore'
import { useSlotsStore } from './slotsStore'
import type { SavedSlot } from './slotsStore'
import { CLOUD_SCHEMA_VERSION, migrateCloudSlot } from './cloudSchema'

/** 인벤토리 인스턴스 깊은 복사 — built를 공유하면 한쪽 편집이 다른 쪽에 샌다 */
const cloneItem = (it: InventoryItem): InventoryItem => ({ ...it, built: structuredClone(it.built) })

/** 현재 상태 → 스냅샷. 직업 미선택이면 null */
export function captureSnapshot(): BuildSnapshot | null {
  const base = useBuildStore.getState().snapshot()
  if (!base) return null
  return {
    ...base,
    selectedMobId: useMonsterStore.getState().selectedId,
    nhit: useNhitStore.getState().capture(),
    personalItems: useInventoryStore
      .getState()
      .items.filter((it) => ownerOf(it) === 'personal')
      .map(cloneItem),
  }
}

/**
 * 클라우드에 올라가는 "현재 화면" 전체. docs/cloud-sync.md §4
 *
 * 저장슬롯(captureSlots)과 접힘 상태(uiStore)는 여기 들어가지 않는다 —
 * 슬롯은 행을 따로 쓰고, 접힘은 기기마다 달라 동기화하면 서로 덮어쓴다.
 */
export interface AppState {
  build: BuildPersisted
  /** 공용 + 개인 인벤토리 전부. 개인만 담는 BuildSnapshot.personalItems와 다르다 */
  inventory: InventoryItem[]
  selectedMobId: number | null
  nhit: NhitSelection
}

export function captureAll(): AppState {
  return {
    build: useBuildStore.getState().captureFull(),
    inventory: useInventoryStore.getState().items.map(cloneItem),
    selectedMobId: useMonsterStore.getState().selectedId,
    nhit: useNhitStore.getState().capture(),
  }
}

/** 인벤토리를 장비 복원보다 먼저 — equipped가 참조하는 id가 존재해야 한다(applySnapshot과 같은 이유) */
export function applyAll(state: AppState): void {
  useInventoryStore.getState().replaceAll((state.inventory ?? []).map(cloneItem))
  useBuildStore.getState().restoreFull(state.build)
  useMonsterStore.getState().select(state.selectedMobId ?? null)
  useNhitStore.getState().restore(state.nhit)
}

export function captureSlots(): (SavedSlot | null)[] {
  return useSlotsStore.getState().slots
}

/** 저장슬롯 → 클라우드 행 (빈 칸은 행을 만들지 않는다) */
export function captureSlotRows(): { idx: number; name: string | null; savedAt: string; snapshot: BuildSnapshot }[] {
  const rows: { idx: number; name: string | null; savedAt: string; snapshot: BuildSnapshot }[] = []
  useSlotsStore.getState().slots.forEach((s, idx) => {
    if (!s) return
    rows.push({
      idx,
      name: s.name ?? null,
      savedAt: new Date(s.savedAt).toISOString(),
      snapshot: s.snapshot,
    })
  })
  return rows
}

/**
 * 클라우드 행 → 저장슬롯.
 * 서버가 이 클라이언트보다 새 스키마면 false — 아무것도 적용하지 않는다(cloudSchema 주석 참고).
 */
export function applySlotRows(
  rows: { idx: number; name: string | null; savedAt: string; schemaVersion: number; snapshot: unknown }[],
): boolean {
  const slots: (SavedSlot | null)[] = []
  for (const r of rows) {
    if (r.schemaVersion > CLOUD_SCHEMA_VERSION) return false
    const snap = migrateCloudSlot(r.snapshot, r.schemaVersion)
    if (!snap) continue // 형태가 깨진 행은 조용히 건너뛴다
    slots[r.idx] = { snapshot: snap, savedAt: Date.parse(r.savedAt) || Date.now(), name: r.name ?? undefined }
  }
  applySlots(slots)
  return true
}

export function applySlots(slots: (SavedSlot | null)[]): void {
  useSlotsStore.getState().replaceAll(slots)
}

/** 이 기기에 계정으로 옮길 만한 데이터가 있는지 — 이관 다이얼로그 분기용(docs/cloud-sync.md §5) */
export function hasLocalData(): boolean {
  if (useBuildStore.getState().jobId !== null) return true
  if (useInventoryStore.getState().items.length > 0) return true
  return useSlotsStore.getState().slots.some((s) => s !== null)
}

/**
 * 동기화 대상 스토어의 변경 구독.
 * uiStore(패널 접힘)는 빠진다 — 기기마다 달라 동기화하면 서로 덮어쓴다(docs/cloud-sync.md §4).
 */
export function subscribeAll(fn: () => void): () => void {
  const unsubs = [
    useBuildStore.subscribe(fn),
    useInventoryStore.subscribe(fn),
    useMonsterStore.subscribe(fn),
    useNhitStore.subscribe(fn),
    useSlotsStore.subscribe(fn),
  ]
  return () => unsubs.forEach((u) => u())
}

/** 이 기기의 전체 상태 한 벌 (게스트 보관용) */
export interface LocalBundle {
  state: AppState
  slots: (SavedSlot | null)[]
  at: number
}

export function captureBundle(): LocalBundle {
  return { state: captureAll(), slots: captureSlots(), at: Date.now() }
}

/**
 * 비로그인(게스트) 데이터 보관소. docs/cloud-sync.md §5
 *
 * 로그인하면 화면이 계정 기준으로 바뀌면서 `mlsv2:*`가 계정 데이터로 채워진다.
 * 그 전에 게스트 벌을 여기 옮겨 두고, 로그아웃할 때 되돌린다 — 로그인했다고 이 기기에서
 * 쓰던 내용이 사라지면 안 된다.
 */
export const GUEST_KEY = 'mlsv2:guest'

/**
 * 게스트 벌 보관. **이미 있으면 덮지 않는다.**
 *
 * 로그인 상태로 새로고침하면 화면에 있는 건 계정 데이터인데, 그때 덮어쓰면 게스트 벌이
 * 계정 데이터로 바뀌어 영영 못 돌아온다. 저장은 로그인 전환 1회뿐이어야 한다.
 */
export function saveGuestBundle(): void {
  try {
    if (localStorage.getItem(GUEST_KEY) !== null) return
    localStorage.setItem(GUEST_KEY, JSON.stringify(captureBundle()))
  } catch {
    // 용량 초과 등 — 보관 실패가 로그인 자체를 막지는 않는다
  }
}

export function clearGuestBundle(): void {
  try {
    localStorage.removeItem(GUEST_KEY)
  } catch {
    /* noop */
  }
}

/** 게스트 벌 읽기. 없거나 깨졌으면 null */
export function loadGuestBundle(): LocalBundle | null {
  try {
    const raw = localStorage.getItem(GUEST_KEY)
    if (!raw) return null
    const b = JSON.parse(raw) as Partial<LocalBundle>
    if (!b || typeof b !== 'object' || !b.state) return null
    return { state: b.state, slots: b.slots ?? [], at: b.at ?? 0 }
  } catch {
    return null
  }
}

/** 게스트 벌로 통째로 되돌린다 (로그아웃 복원 · '전체 덮어쓰기') */
export function restoreBundle(b: LocalBundle): void {
  applyAll(b.state)
  applySlots(b.slots)
}

/**
 * 로그아웃 — 계정 데이터를 이 기기에서 지우고 게스트 벌로 되돌린다.
 * 게스트 벌이 없으면(비로그인 데이터가 애초에 없었으면) 빈 상태로 되돌린다.
 */
export function restoreGuest(): void {
  const guest = loadGuestBundle()
  if (guest) restoreBundle(guest)
  else clearAll()
  clearGuestBundle()
}

/**
 * 빌드·인벤토리(공용 포함)·대상 몹·n타를 비운다. **저장 슬롯은 건드리지 않는다** —
 * 슬롯은 행을 따로 받아 applySlotRows가 이미 처리한 뒤라 여기서 또 비우면 그걸 지운다.
 *
 * 계정이 비어 있을 때 그 상태를 그대로 보여주려면 필요하다. 안 비우면 직전(로컬) 내용이
 * 남아 계정 데이터인 것처럼 보인다.
 */
export function clearAppState(): void {
  resetAll()
  useInventoryStore.getState().replaceAll([])
}

/** 슬롯까지 포함해 전부 비운다 */
export function clearAll(): void {
  clearAppState()
  applySlots([])
}

/**
 * 전체 초기화 — 슬롯을 따라다니는 상태를 전부 비운다.
 * buildStore.reset()만 부르면 개인 인벤토리·대상 몬스터·n타 선택이 남아
 * 새 직업을 골라도 이전 빌드의 흔적이 그대로 보인다. 공용 인벤토리는 창고이므로 유지.
 */
export function resetAll(): void {
  useBuildStore.getState().reset()
  useInventoryStore.getState().replacePersonal([])
  useMonsterStore.getState().select(null)
  useNhitStore.getState().reset()
}

/**
 * 스냅샷 → 현재 상태.
 * 개인 인벤토리를 장비 복원보다 먼저 넣어야 equipped가 참조하는 id가 존재한다.
 */
export function applySnapshot(snap: BuildSnapshot): void {
  useInventoryStore.getState().replacePersonal(
    (snap.personalItems ?? []).map((it) => ({ ...it, built: structuredClone(it.built) })),
  )
  useBuildStore.getState().loadSnapshot(snap)
  useMonsterStore.getState().select(snap.selectedMobId ?? null)
  useNhitStore.getState().restore(snap.nhit)
}
