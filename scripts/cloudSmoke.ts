/**
 * 클라우드 동기화 캡처/복원 왕복 확인. docs/cloud-sync.md §4
 *
 * 네트워크를 타지 않는다 — `captureAll()` → JSON 직렬화(서버 왕복 흉내) → `applyAll()` 후
 * 상태가 그대로인지만 본다. Supabase 키 없이 돌아간다.
 *
 * 특히 지키려는 것: 저장슬롯 스냅샷(`BuildSnapshot`)이 버리는 masteryOff·buffLevels가
 * 클라우드 경로에서는 살아남아야 한다. 이게 깨지면 다른 기기에서 공격력이 조용히 달라진다.
 *
 *   npx tsx scripts/cloudSmoke.ts
 */

// zustand persist가 붙기 전에 localStorage를 깔아둔다 — Node에는 없다.
// zustand v5는 바 `localStorage`가 아니라 **`window.localStorage`**를 본다
// (node_modules/zustand/esm/middleware.mjs). window가 없으면 getStorage()가 던져서 영속화가
// 통째로 꺼지고 "storage is currently unavailable" 경고만 남는다 — 둘 다 깔아야 한다.
const mem = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  writable: true,
  value: {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
    clear: () => mem.clear(),
    key: (i: number) => [...mem.keys()][i] ?? null,
    get length() {
      return mem.size
    },
  } as Storage,
})
// 가짜 객체를 만들지 않고 전역을 그대로 가리킨다 — 다른 브라우저 API가 있는 척하지 않게
;(globalThis as unknown as { window: typeof globalThis }).window ??= globalThis

// 스토어는 import 시점에 persist가 localStorage를 잡으므로 shim 이후에 불러온다
const { useBuildStore } = await import('../src/store/buildStore')
const { useInventoryStore } = await import('../src/store/inventoryStore')
const { useMonsterStore } = await import('../src/store/monsterStore')
const { useNhitStore } = await import('../src/store/nhitStore')
const { useSlotsStore } = await import('../src/store/slotsStore')
const {
  captureAll,
  applyAll,
  captureSnapshot,
  captureSlots,
  applySlots,
  hasLocalData,
  resetAll,
  saveGuestBundle,
  loadGuestBundle,
  restoreGuest,
} = await import('../src/store/snapshot')
const { CATALOG_ITEMS } = await import('../src/data/catalog')
const { emptyBuiltItem } = await import('../src/domain/builtItem')

let failures = 0
function check(label: string, ok: boolean, detail?: string): void {
  if (ok) {
    console.log(`  ok   ${label}`)
  } else {
    failures++
    console.error(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

/** 서버 왕복 흉내 — jsonb에 들어갔다 나오면 남는 건 JSON으로 표현되는 것뿐이다 */
const roundTrip = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T

// ── 상태 만들기 ────────────────────────────────────────────────
console.log('클라우드 캡처/복원 왕복')

// 카탈로그의 아무 모자나 — 특정 id를 박으면 카탈로그가 바뀔 때 스모크가 먼저 깨진다
const item = CATALOG_ITEMS.find((it) => it.slot === 'hat')
if (!item) throw new Error('카탈로그에 모자가 없다')

useBuildStore.getState().selectJob('hero')
useBuildStore.getState().setLevel(180)
useInventoryStore.getState().add(emptyBuiltItem(item), 'personal')
useInventoryStore.getState().add(emptyBuiltItem(item), 'shared')

const invId = useInventoryStore.getState().items[0].id
useBuildStore.getState().equip('hat', invId)

// BuildSnapshot이 버리는 것들 — 이번 왕복에서 살아남아야 한다.
// 직업에 마스터리가 없어도 토글 자체는 id를 가리지 않으므로 전송 경로는 확인된다.
const masteryId = Object.keys(useBuildStore.getState().masteryLevels)[0] ?? '1100000'
useBuildStore.getState().toggleMastery(masteryId)
useBuildStore.getState().setBaseResources({ hp: 12345, mp: 6789 })

useMonsterStore.getState().select(9400589)
useNhitStore.getState().setSkill(1121008, 20)
useNhitStore.getState().addPreCast(1121000, 10)

const before = roundTrip(captureAll())

// ── 왕복 ──────────────────────────────────────────────────────
resetAll()
// resetAll은 공용 인벤토리를 일부러 남긴다(창고) — 지워지는 건 빌드·개인 인벤토리·몹·n타뿐이다
check('resetAll: 빌드 비움', useBuildStore.getState().jobId === null)
check(
  'resetAll: 개인 인벤토리만 비움 (공용은 유지)',
  useInventoryStore.getState().items.length === 1,
  `남은 개수 ${useInventoryStore.getState().items.length}`,
)

applyAll(before)
const after = roundTrip(captureAll())

check('전체 상태가 동일', JSON.stringify(after) === JSON.stringify(before))
check('장착 id가 인벤토리에 존재', useInventoryStore.getState().getById(invId) !== undefined)
check('공용 인벤토리도 복원', useInventoryStore.getState().items.length === 2)
check('baseHp/baseMp 유지', after.build.baseHp === 12345 && after.build.baseMp === 6789)
// 값만 오고 레벨이 빠지면 다른 기기에서 "다시 입력하세요"로 보인다 — 짝이 같이 건너와야 한다
check(
  'baseHp/baseMp 입력 레벨 유지',
  after.build.baseHpLevel === 180 && after.build.baseMpLevel === 180,
  `${after.build.baseHpLevel} / ${after.build.baseMpLevel}`,
)
check('대상 몬스터 유지', after.selectedMobId === 9400589)
check('n타 선택 유지', after.nhit.skillId === 1121008 && after.nhit.preCast.length === 1)

check('masteryOff 유지 (클라우드 경로)', after.build.masteryOff[masteryId] === true)
// 경계 문서화: 저장슬롯은 이걸 일부러 버린다. 여기가 깨지면 둘 중 하나가 잘못 바뀐 것이다.
const slotSnapForBoundary = captureSnapshot()
check(
  'BuildSnapshot은 masteryOff를 담지 않는다 (경계 유지)',
  slotSnapForBoundary !== null && !('masteryOff' in slotSnapForBoundary),
)

// ── 저장슬롯 왕복 ─────────────────────────────────────────────
const snap = captureSnapshot()
if (!snap) throw new Error('captureSnapshot이 null — 직업이 선택돼 있어야 한다')
useSlotsStore.getState().save(3, snap, '테스트')

const slots = roundTrip(captureSlots())
useSlotsStore.getState().clear(3)
applySlots(slots)

const restored = useSlotsStore.getState().slots
check('슬롯 24칸 유지', restored.length === 24)
check('슬롯 내용 복원', restored[3]?.name === '테스트' && restored[3]?.snapshot.jobId === 'hero')
check('슬롯 스냅샷도 기본 HP의 입력 레벨을 담는다', restored[3]?.snapshot.baseHpLevel === 180)
check('빈 칸은 그대로 null', restored[0] === null)
check('hasLocalData 감지', hasLocalData())

// ── 게스트 벌 보관/복원 (docs/cloud-sync.md §5) ────────────────
// 로그인해도 비로그인 데이터가 사라지면 안 되고, 로그아웃하면 그대로 돌아와야 한다.
console.log('\n게스트 벌 보관/복원')

const guestState = roundTrip(captureAll())
const guestSlots = roundTrip(captureSlots())
saveGuestBundle()

// 계정 데이터를 받아 화면이 바뀐 상황을 흉내낸다
resetAll()
useBuildStore.getState().selectJob('paladin')
useBuildStore.getState().setLevel(70)
useSlotsStore.getState().clear(3)

// 로그인 상태로 새로고침하면 여기가 또 불린다. 덮이면 게스트 벌이 계정 데이터로
// 바뀌어 영영 못 돌아온다 — 이 스모크의 핵심.
saveGuestBundle()
check('새로고침해도 게스트 벌은 안 덮인다', loadGuestBundle()?.state.build.jobId === 'hero')

restoreGuest()
check('로그아웃하면 게스트 상태로 돌아온다', JSON.stringify(roundTrip(captureAll())) === JSON.stringify(guestState))
check('게스트 슬롯도 돌아온다', JSON.stringify(roundTrip(captureSlots())) === JSON.stringify(guestSlots))
check('복원하면 게스트 벌은 지워진다', loadGuestBundle() === null)

console.log(failures === 0 ? '\n전부 통과' : `\n${failures}건 실패`)
process.exit(failures === 0 ? 0 : 1)
