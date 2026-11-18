/**
 * 수동 스모크 테스트: 캡슐 스킬 (tsx)
 *  - 파이어 버너 · 쿨링 이펙트(캡틴): '(불릿)' + '(캡슐)' 두 항목, 기본 id가 캡슐
 *  - 불릿 배율 0.5 · 캡슐 1, 캡슐 장전 판정은 기본 항목만
 *  - 20억 오프셋이 기존 변형(스턴 겹침 등)의 판정을 건드리지 않는다
 *  - 속성강화(5220001) 패시브가 캡틴 버프 목록에 있고 damage가 스킬북에서 읽힌다
 */
import {
  baseSkillId, bulletOnlyMultOf, chargeMultOf, damageSkillsForJob, usesCapsule, variantKindsOf, variantSkillId,
  CAPSULE_SKILLS, ELEMENTAL_BOOST_ID,
} from '../src/data/skills/variants'
import { skillNumAt } from '../src/data/skills'
import { buffsForJob } from '../src/data/buff'

let fail = 0
const check = (ok: boolean, msg: string) => {
  if (!ok) fail++
  console.log(ok ? '  ✓' : '  ✗', msg)
}

console.log('항목 펼침 (캡틴)')
const list = damageSkillsForJob('captain')
const nameOf = (sid: number) => list.find((s) => s.id === sid)?.description?.name
for (const [id, label] of [[5211004, '파이어 버너'], [5211005, '쿨링 이펙트']] as const) {
  const bullet = variantSkillId(id, 'bullet')
  check(nameOf(id) === `${label} (캡슐)`, `${label} 기본 항목 (${nameOf(id)})`)
  check(nameOf(bullet) === `${label} (불릿)`, `${label} 불릿 항목 (${nameOf(bullet)})`)
  const idx = list.findIndex((s) => s.id === bullet)
  check(idx >= 0 && list[idx + 1]?.id === id, `${label} (불릿) 다음에 (캡슐)`)
  check(bulletOnlyMultOf(id) === 1 && bulletOnlyMultOf(bullet) === 0.5, `${label} 배율 캡슐 1 / 불릿 0.5`)
  check(usesCapsule(id) && !usesCapsule(bullet), `${label} 캡슐 장전 판정`)
  check(baseSkillId(bullet) === id && bullet % 100_000_000 === id, `${label} 기본 id 왕복 (${bullet})`)
  check(bullet <= 2 ** 31 - 1, `${label} 불릿 id int32 범위`)
}
check(CAPSULE_SKILLS.get(5211004) === 2331000 && CAPSULE_SKILLS.get(5211005) === 2332000, '캡슐 id 블레이즈 2331000 · 글레이즈 2332000')

console.log('기존 변형 영향 없음')
const halfStun = variantSkillId(variantSkillId(5101004, 'halfCharge'), 'stun')
check(variantKindsOf(halfStun).join() === 'stun,halfCharge', `스크류 펀치 (반차징) (스턴) 판정 (${variantKindsOf(halfStun).join()})`)
check(bulletOnlyMultOf(halfStun) === 1 && chargeMultOf(halfStun) === 0.5, '스턴 겹침 조합에 불릿 배율 없음')
check(!damageSkillsForJob('viper').some((s) => variantKindsOf(s.id).includes('bullet')), '바이퍼에는 불릿 항목 없음')
check(bulletOnlyMultOf(5221004) === 1 && !usesCapsule(5221004), '래피드 파이어 영향 없음')

console.log('속성강화 패시브')
const eb = buffsForJob('captain').find((b) => b.id === String(ELEMENTAL_BOOST_ID))
check(!!eb && eb.type === 'skill' && eb.mode === 'passive', `캡틴 패시브에 속성강화 (${eb?.name})`)
check(!buffsForJob('viper').some((b) => b.id === String(ELEMENTAL_BOOST_ID)), '바이퍼에는 없음')
const d1 = skillNumAt(ELEMENTAL_BOOST_ID, 1, 'damage')
const d30 = skillNumAt(ELEMENTAL_BOOST_ID, 30, 'damage')
check(d1 === 6 && d30 === 200, `속성강화 damage 1레벨 ${d1} · 30레벨 ${d30}`)
check(skillNumAt(5211004, 30, 'damage') + d30 === 390, '파이어 버너 30 + 속성강화 30 = 390%')

console.log(fail ? `\n실패 ${fail}건` : '\n전부 통과')
process.exit(fail ? 1 : 0)
