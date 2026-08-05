/**
 * 몬스터 출현 지역(foundAt) → 대표 카테고리 분류.
 *
 * 몬스터 선택 UI의 "지역" 필터를 세부 지역 24종 대신 10개 카테고리로 묶는다.
 * 아이콘은 maplestory.io 맵 아이콘을 받아 public/region-icons/에 저장한 정적 에셋.
 */

export interface RegionCategory {
  /** 카테고리 표시명 */
  name: string
  /** 아이콘 경로 (public/region-icons/*.png) */
  icon: string
  /** 이 카테고리에 속하는 foundAt 지역명 */
  regions: string[]
}

export const REGION_CATEGORIES: RegionCategory[] = [
  { name: '빅토리아 아일랜드', icon: '/region-icons/victoria.png', regions: ['빅토리아 아일랜드', '아랫마을', '엘린숲'] },
  { name: '세계여행', icon: '/region-icons/worldtour.png', regions: ['해외여행: 일본', '해외여행: 대만', '해외여행: 중국', '해외여행: 태국'] },
  { name: '루더스 호수', icon: '/region-icons/ludus.png', regions: ['루디브리엄', '시계탑 최하층', '루디브리엄 파퀘', '지구방위본부', '샤레니안'] },
  { name: '니할 사막', icon: '/region-icons/nihal.png', regions: ['아리안트', '마가티아'] },
  { name: '엘나스 산맥', icon: '/region-icons/elnath.png', regions: ['엘나스', '오르비스', '아쿠아리움', '폐광'] },
  { name: '무릉도원', icon: '/region-icons/mulung.png', regions: ['무릉도원', '백초마을'] },
  { name: '미나르숲', icon: '/region-icons/minar.png', regions: ['리프레'] },
  { name: '시간의 신전', icon: '/region-icons/temple.png', regions: ['시간의 신전'] },
  { name: '마스테리아', icon: '/region-icons/masteria.png', regions: ['뉴 리프 시티'] },
  { name: '몬스터 카니발', icon: '/region-icons/carnival.png', regions: ['몬스터 카니발'] },
]

/** foundAt 지역명 → 카테고리명 */
const REGION_TO_CATEGORY: Record<string, string> = {}
for (const c of REGION_CATEGORIES) for (const r of c.regions) REGION_TO_CATEGORY[r] = c.name

/** 몬스터의 foundAt 지역들이 속한 카테고리명 집합 */
export function categoriesOf(foundAt: string[] | undefined): string[] {
  const set = new Set<string>()
  for (const r of foundAt ?? []) {
    const c = REGION_TO_CATEGORY[r]
    if (c) set.add(c)
  }
  return [...set]
}
