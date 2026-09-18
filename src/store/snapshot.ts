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
