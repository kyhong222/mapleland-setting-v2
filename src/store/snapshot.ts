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

/** 이 기기의 전체 상태 한 벌 (이관 전 백업·병합 입력) */
export interface LocalBundle {
  state: AppState
  slots: (SavedSlot | null)[]
  at: number
}

export function captureBundle(): LocalBundle {
  return { state: captureAll(), slots: captureSlots(), at: Date.now() }
}

/** 덮어쓰기 직전 복구 경로. 마지막 1벌만 유지한다(docs/cloud-sync.md §5) */
export const BACKUP_KEY = 'mlsv2:backup'

export function saveLocalBackup(): void {
  try {
    localStorage.setItem(BACKUP_KEY, JSON.stringify(captureBundle()))
  } catch {
    // 용량 초과 등 — 백업 실패가 이관 자체를 막지는 않는다
  }
}

/** AppState에서 저장슬롯용 스냅샷을 만든다 (병합에서 로컬 현재 빌드를 잃지 않게 쓴다) */
function snapshotFromAppState(s: AppState): BuildSnapshot | null {
  const b = s.build
  if (!b.jobId) return null
  return {
    jobId: b.jobId,
    level: b.level,
    baseStats: b.baseStats,
    equipped: b.equipped,
    activeBuffs: b.activeBuffs,
    appliedBuffs: b.appliedBuffs,
    masteryLevels: b.masteryLevels,
    baseHp: b.baseHp,
    baseMp: b.baseMp,
    charge: b.charge,
    selectedMobId: s.selectedMobId,
    nhit: s.nhit,
    personalItems: (s.inventory ?? []).filter((it) => ownerOf(it) === 'personal').map(cloneItem),
  }
}

export interface MergeResult {
  slotsAdded: number
  /** 24칸이 모자라 넣지 못한 수 */
  slotsSkipped: number
  sharedItemsAdded: number
}

/**
 * 계정 데이터를 적용한 **뒤에** 이 기기 것을 손실 없이 얹는다(docs/cloud-sync.md §5).
 *
 * - 저장슬롯: 비어 있는 칸에만 넣는다. 계정 슬롯을 덮지 않는다.
 * - 로컬의 현재 작업 빌드는 화면에서는 계정 것에 밀리므로, 잃지 않도록 슬롯 한 칸으로 만들어 넣는다.
 * - 공용 인벤토리: 합집합(id가 겹치면 이미 같은 아이템이므로 건너뛴다).
 *   로컬 개인 인벤토리는 위 '이 기기 빌드' 슬롯이 들고 있으므로 따로 합치지 않는다.
 */
export function mergeLocalInto(local: LocalBundle): MergeResult {
  const incoming: SavedSlot[] = []
  const currentBuild = snapshotFromAppState(local.state)
  if (currentBuild) incoming.push({ snapshot: currentBuild, savedAt: local.at, name: '이 기기 빌드' })
  for (const s of local.slots) if (s) incoming.push(s)

  const slots = useSlotsStore.getState().slots.slice()
  let slotsAdded = 0
  let slotsSkipped = 0
  for (const s of incoming) {
    const free = slots.findIndex((x) => x === null)
    if (free < 0) {
      slotsSkipped++
      continue
    }
    slots[free] = s
    slotsAdded++
  }
  useSlotsStore.getState().replaceAll(slots)

  const items = useInventoryStore.getState().items
  const known = new Set(items.map((it) => it.id))
  const incomingShared = (local.state.inventory ?? [])
    .filter((it) => ownerOf(it) === 'shared' && !known.has(it.id))
    .map(cloneItem)
  if (incomingShared.length > 0) useInventoryStore.getState().replaceAll([...items, ...incomingShared])

  return { slotsAdded, slotsSkipped, sharedItemsAdded: incomingShared.length }
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
