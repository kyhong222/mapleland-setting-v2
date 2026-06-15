/** 수동 스모크 테스트: getItem(카탈로그/API) 검증 (tsx) */
import { getItem } from '../src/data/itemRepository'
import { CATALOG_ITEMS, getCatalogItem, listCatalogBySlot } from '../src/data/catalog'

async function main() {
  console.log('카탈로그 총 아이템:', CATALOG_ITEMS.length)
  console.log('  hat:', listCatalogBySlot('hat').length, '| weapon:', listCatalogBySlot('weapon').length, '| belt:', listCatalogBySlot('belt').length)
  console.log('  카탈로그에 1002357 있나:', !!getCatalogItem(1002357))

  const ids = [
    1002357, // 카탈로그(모자) → 로컬
    1302000, // 카탈로그(검) → 로컬
    1452001, // 카탈로그(활) → 로컬
    1004422, // 카탈로그 없음 → API GMS200 폴백
    9999999, // 미존재 → null
  ]
  for (const id of ids) {
    const item = await getItem(id)
    console.log(id, '->', JSON.stringify(item))
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
