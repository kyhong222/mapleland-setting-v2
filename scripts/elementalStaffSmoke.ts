/**
 * 수동 스모크 테스트: 속성 스태프 (tsx)
 *  - 카탈로그 스펙 4종 (70제 / INT 213 / LUK 73 / 공 56 / 마 85 / 공속 7 / 업횟 7)
 *  - 속성배율 표 (docs/nhit-dpm.md §4 속성 스태프)
 *  - 소환수가 공격 스킬에서 빠져 있는지 (속성 스태프 보정 대상이 아님)
 */
import { getItem } from '../src/data/itemRepository'
import { attackSkillsForJob } from '../src/data/skills'
import { ELEMENT_MULT, staffElementMult } from '../src/domain/damage'
import type { ElementReaction } from '../src/domain/damage'

let fail = 0
const check = (ok: boolean, msg: string) => {
  if (!ok) fail++
  console.log(ok ? '  ✓' : '  ✗', msg)
}

const STAVES: [number, string][] = [[1382045, 'F'], [1382046, 'S'], [1382047, 'I'], [1382048, 'L']]

/** [반응, 같은 속성 배율, 다른 속성 배율] */
const TABLE: [ElementReaction, number, number][] = [
  ['weak', 1.6, 1.25],
  ['none', 1.1, 0.75],
  ['half', 0.6, 0.25],
  ['immune', 0, 0],
]

async function main() {
  console.log('[카탈로그]')
  for (const [id, element] of STAVES) {
    const i = await getItem(id)
    const ok = !!i && i.weaponType === 'staff' && i.weaponElement === element
      && i.reqLevel === 70 && i.reqInt === 213 && i.reqLuk === 73 && i.reqJob === 2 && i.tuc === 7
      && i.effects.INT === 1 && i.effects.pad === 56 && i.effects.mad === 85 && i.effects.attackSpeed === 7
    check(ok, `${id} ${i?.name}`)
  }

  console.log('[속성배율]')
  const near = (a: number, b: number) => Math.abs(a - b) < 1e-9
  for (const [reaction, match, off] of TABLE) {
    const base = ELEMENT_MULT[reaction]
    check(near(staffElementMult(base, 'F', 'F'), match), `같은 속성 ${reaction} ×${match}`)
    check(near(staffElementMult(base, 'I', 'F'), off), `다른 속성 ${reaction} ×${off}`)
    check(near(staffElementMult(base, undefined, 'F'), off), `무속성 ${reaction} ×${off}`)
    check(staffElementMult(base, 'F', undefined) === base, `일반 무기 ${reaction} ×${base}`)
  }

  console.log('[소환수 제외]')
  const names = attackSkillsForJob('archMageIL').concat(attackSkillsForJob('archMageFP')).map((s) => s.description?.name)
  check(!names.includes('엘퀴네스') && !names.includes('이프리트'), '이프리트·엘퀴네스는 공격 스킬이 아님')

  console.log(fail ? `실패 ${fail}건` : '모두 통과')
  process.exit(fail ? 1 : 0)
}

main()
