import { listScrollsForItem, listScrollsForSlot } from '../src/data/scrolls'
import { getItem } from '../src/data/itemRepository'

async function main() {
  const horntail = await getItem(1122000) // 혼테일의 목걸이
  const horus = await getItem(1122010) // 호루스의 눈
  const spiegel = await getItem(1122007) // 슈피겔만의 목걸이
  for (const [label, it] of [['혼테일', horntail], ['호루스', horus], ['슈피겔만', spiegel]] as const) {
    const scrolls = it ? listScrollsForItem(it) : []
    console.log(`${label}(${it?.id}) 적용가능 주문서:`, scrolls.map((s) => s.name))
  }
  console.log('pendant 슬롯 일반 주문서:', listScrollsForSlot('pendant').map((s) => s.name))
}
main()
