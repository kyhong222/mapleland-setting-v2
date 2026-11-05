/**
 * 수동 스모크 테스트: 물리 속성 반응 (tsx) — docs/nhit-dpm.md §3
 *  - 핑크빈 P2가 물리 반감으로 읽히고, 속성 공격은 그 속성으로만 판정
 *  - 방어 차감 전에 곱해지는지 손계산 대조
 *  - P가 없는 몹은 수치 변화 없음
 */
import { getMonster, MONSTERS } from '../src/data/mobs'
import { physicalVsMonster } from '../src/domain/attackPower'
import { elementReaction, formatElemAttr, PHYSICAL_ELEMENT } from '../src/domain/monster'
import { baseElementMult } from '../src/domain/skillCombat'

let fail = 0
const check = (ok: boolean, msg: string) => {
  if (!ok) fail++
  console.log(ok ? '  ✓' : '  ✗', msg)
}

const pinkBean = getMonster(8820001)!

console.log('반응 판정')
check(elementReaction(pinkBean.elemAttr, PHYSICAL_ELEMENT) === 'half', '핑크빈 물리 반감')
check(formatElemAttr(pinkBean.elemAttr).includes('물리 반감'), `표기: ${formatElemAttr(pinkBean.elemAttr)}`)
check(elementReaction(pinkBean.elemAttr, 'L') === 'none', '번개 공격은 무반응 (물리 반감을 겹쳐 받지 않음)')
check(elementReaction(pinkBean.elemAttr, 'F') === 'half', '불 공격은 불 반감으로만 판정')
check(baseElementMult('half') === 0.5, '반감 배율 0.5')

console.log('방어 차감 순서')
const display = { min: 10000, max: 10000 }
const halved = physicalVsMonster(display, 1700, 0, 0.5)
check(halved.max === 4150, `MAX 10000×0.5 − 850 = 4150 (${halved.max})`)
check(halved.min === 3980, `MIN 10000×0.5 − 1020 = 3980 (${halved.min})`)
const plain = physicalVsMonster(display, 1700, 0)
check(plain.max === 9150, `배율 생략 시 기존과 동일 (${plain.max})`)

console.log('기존 몹 영향')
const others = MONSTERS.filter((m) => m.id !== 8820001 && elementReaction(m.elemAttr, PHYSICAL_ELEMENT) !== 'none')
check(others.length === 0, `물리 반응을 가진 몹은 핑크빈뿐 (그 외 ${others.length}종)`)

console.log(fail ? `\n실패 ${fail}건` : '\n전부 통과')
if (fail) process.exit(1)
