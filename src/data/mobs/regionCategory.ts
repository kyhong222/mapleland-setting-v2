/**
 * 몬스터 출현 지역(foundAt) → 대표 카테고리 분류.
 *
 * 몬스터 선택 UI의 "지역" 필터를 상위 카테고리(아이콘 없음) > 하위 지역(맵 아이콘)
 * 2단계 계층으로 묶는다. 지역 아이콘은 maplestory.io 맵 아이콘을 받아
 * public/region-icons/map-{mapId}.png 로 저장한 정적 에셋.
 */

export interface RegionEntry {
  /** foundAt 지역명 */
  name: string
  /** 지역 대표 맵 아이콘 경로 */
  icon: string
}

export interface RegionCategory {
  /** 카테고리 표시명 (아이콘 없음) */
  name: string
  /** 소속 지역(각자 맵 아이콘 보유) */
  regions: RegionEntry[]
}

const ic = (mapId: number) => `/region-icons/map-${mapId}.png`

export const REGION_CATEGORIES: RegionCategory[] = [
  { name: '빅토리아 아일랜드', regions: [{ name: '빅토리아 아일랜드', icon: ic(104010000) }] },
  { name: '세계여행', regions: [
    { name: '해외여행: 일본', icon: ic(993000400) },
    { name: '해외여행: 대만', icon: ic(993000400) },
    { name: '해외여행: 중국', icon: ic(993000400) },
    { name: '해외여행: 태국', icon: ic(993000400) },
  ] },
  { name: '루더스 호수', regions: [
    { name: '루디브리엄', icon: ic(221022600) },
    { name: '시계탑 최하층', icon: ic(220060000) },
    { name: '지구방위본부', icon: ic(221030000) },
    { name: '아랫마을', icon: ic(224000000) },
    { name: '엘린숲', icon: ic(300020200) },
  ] },
  { name: '니할 사막', regions: [
    { name: '아리안트', icon: ic(260010700) },
    { name: '마가티아', icon: ic(261010001) },
  ] },
  { name: '엘나스 산맥', regions: [
    { name: '엘나스', icon: ic(200081600) },
    { name: '오르비스', icon: ic(200080200) },
    { name: '아쿠아리움', icon: ic(230030100) },
    { name: '폐광', icon: ic(211041100) },
  ] },
  { name: '무릉도원', regions: [
    { name: '무릉도원', icon: ic(250010000) },
    { name: '백초마을', icon: ic(251010000) },
  ] },
  { name: '미나르숲', regions: [{ name: '리프레', icon: ic(240010000) }] },
  { name: '시간의 신전', regions: [{ name: '시간의 신전', icon: ic(270010100) }] },
  { name: '마스테리아', regions: [{ name: '뉴 리프 시티', icon: ic(600000000) }] },
  { name: '무릉도장', regions: [{ name: '무릉도장', icon: ic(925020000) }] },
  { name: '파티퀘스트', regions: [
    { name: '샤레니안', icon: ic(308000001) },
    { name: '몬스터 카니발', icon: ic(980000101) },
    { name: '루디브리엄 파퀘', icon: ic(922010100) },
  ] },
]

/** foundAt 지역명 → 카테고리명 */
const REGION_TO_CATEGORY: Record<string, string> = {}
for (const c of REGION_CATEGORIES) for (const r of c.regions) REGION_TO_CATEGORY[r.name] = c.name

/** foundAt 지역명 → 대표 아이콘 경로 */
export const REGION_ICON: Record<string, string> = {}
for (const c of REGION_CATEGORIES) for (const r of c.regions) REGION_ICON[r.name] = r.icon

/** 몬스터의 foundAt 지역들이 속한 카테고리명 집합 */
export function categoriesOf(foundAt: string[] | undefined): string[] {
  const set = new Set<string>()
  for (const r of foundAt ?? []) {
    const c = REGION_TO_CATEGORY[r]
    if (c) set.add(c)
  }
  return [...set]
}
