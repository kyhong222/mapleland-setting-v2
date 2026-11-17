/**
 * 수동 스모크 테스트: 도핑 목록 (tsx) — buildStore dopingList / appliedBuffs
 *  - 계산은 appliedBuffs(켜진 것)만 본다 → 끄면 목록에는 남고 적용에서만 빠진다
 *  - toggleDoping: 껐다 켜도 레벨이 그대로
 *  - setDopingList: 빠진 항목 제거, 새 항목은 켜서 추가, 남은 항목은 on/off 유지
 *  - setAppliedLevel: 꺼진 항목도 레벨이 바뀌고, 켜진 항목은 적용 레벨도 바뀐다
 *  - 구버전 스냅샷(dopingList 없음) 복원 시 켜진 것으로 목록을 채운다
 */

// zustand persist가 window.localStorage를 보므로 스토어 import 전에 깔아 둔다 (cloudSmoke.ts 참고)
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
;(globalThis as unknown as { window: typeof globalThis }).window ??= globalThis

const { useBuildStore } = await import('../src/store/buildStore')
const { DOPING_ITEMS, PARTY_BUFFS } = await import('../src/data/buff')

let fail = 0
const check = (ok: boolean, msg: string) => {
  if (!ok) fail++
  console.log(ok ? '  ✓' : '  ✗', msg)
}
const st = () => useBuildStore.getState()

const item = DOPING_ITEMS[0].id
const party = PARTY_BUFFS.find((b) => b.type === 'skill' && b.masterLevel > 1 && !b.variants)!
const item2 = DOPING_ITEMS[1].id

st().selectJob('hero')

console.log('편집 반영')
st().setDopingList({ [item]: 1, [party.id]: 5 })
check(item in st().appliedBuffs && party.id in st().appliedBuffs, '새 항목은 켜진 채로 들어간다')
check(st().dopingList[party.id] === 5 && st().appliedBuffs[party.id] === 5, '편집한 레벨로 들어간다')

console.log('ON / OFF')
st().toggleDoping(party.id)
check(!(party.id in st().appliedBuffs) && st().dopingList[party.id] === 5, '끄면 적용에서만 빠지고 목록에 남는다')
st().setAppliedLevel(party.id, 7)
check(st().dopingList[party.id] === 7 && !(party.id in st().appliedBuffs), '꺼진 항목도 레벨이 바뀐다(켜지지는 않음)')
st().toggleDoping(party.id)
check(st().appliedBuffs[party.id] === 7, '다시 켜면 기억한 레벨로 켜진다')
st().setAppliedLevel(party.id, 3)
check(st().appliedBuffs[party.id] === 3 && st().dopingList[party.id] === 3, '켜진 항목은 적용 레벨도 함께 바뀐다')

console.log('편집 시 on/off 유지')
st().toggleDoping(item)
st().setDopingList({ [item]: 1, [party.id]: 3, [item2]: 1 })
check(!(item in st().appliedBuffs) && item in st().dopingList, '꺼 둔 항목은 편집 후에도 꺼진 채')
check(item2 in st().appliedBuffs, '새로 넣은 항목은 켜짐')
st().setDopingList({ [item2]: 1 })
check(!(item in st().dopingList) && !(party.id in st().appliedBuffs) && !(party.id in st().dopingList), '빠진 항목은 목록·적용 모두에서 제거')

console.log('스냅샷 왕복 / 구버전 복원')
st().setDopingList({ [item]: 1, [party.id]: 4 })
st().toggleDoping(item)
const snap = st().snapshot()!
check(snap.dopingList?.[item] === 1 && !(item in snap.appliedBuffs), '스냅샷에 꺼진 항목이 실린다')
st().reset()
st().loadSnapshot(snap)
check(item in st().dopingList && !(item in st().appliedBuffs) && st().appliedBuffs[party.id] === 4, '스냅샷 복원 후 on/off·레벨 그대로')
const old = { ...snap, dopingList: undefined }
st().reset()
st().loadSnapshot(old)
check(st().dopingList[party.id] === 4 && !(item in st().dopingList), '구버전 스냅샷: 켜진 것으로 목록을 채운다')

console.log(fail ? `\n실패 ${fail}건` : '\n전부 통과')
process.exit(fail ? 1 : 0)
