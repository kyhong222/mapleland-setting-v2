import { getItem } from '../src/data/itemRepository'

async function main() {
  for (const id of [1092050 /*칸자르*/, 1122059 /*나리케인의 징표*/, 1002357 /*자쿰투구(미오버라이드)*/]) {
    const it = await getItem(id)
    console.log(id, '->', it?.name, '| tuc:', it?.tuc, '| effects:', JSON.stringify(it?.effects))
  }
}
main()
