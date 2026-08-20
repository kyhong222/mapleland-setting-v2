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
import type { BuildSnapshot } from './buildStore'
import { useMonsterStore } from './monsterStore'
import { useNhitStore } from './nhitStore'
import { useInventoryStore, ownerOf } from './inventoryStore'

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
      .map((it) => ({ ...it, built: structuredClone(it.built) })),
  }
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
