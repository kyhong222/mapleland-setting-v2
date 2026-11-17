/**
 * 수동 스모크 테스트: 전이 스킬 (tsx)
 *  - 체인 라이트닝(썬콜) · 에너지 오브(바이퍼): 기본 + '(70%)' + '(49%)' 세 항목
 *  - 전이 배율 1전이 0.7 · 2전이 0.49, 기본 1
 *  - 바이퍼 에너지 오브는 스턴 변형과 겹쳐도 id 왕복·배율이 유지된다
 *  - 다른 스킬·변형(차징)에 영향 없음
 */
import {
  baseSkillId, chargeMultOf, damageSkillsForJob, transferMultOf, variantKindsOf, variantSkillId,
} from '../src/data/skills/variants'

let fail = 0
const check = (ok: boolean, msg: string) => {
  if (!ok) fail++
  console.log(ok ? '  ✓' : '  ✗', msg)
}
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9

console.log('항목 펼침')
for (const [job, id, label] of [['archMageIL', 2221006, '체인 라이트닝'], ['viper', 5121002, '에너지 오브']] as const) {
  const list = damageSkillsForJob(job)
  const t1 = variantSkillId(id, 'transfer1')
  const t2 = variantSkillId(id, 'transfer2')
  const names = (sid: number) => list.find((s) => s.id === sid)?.description?.name
  check(names(id) === label, `${label} 기본 항목 (${names(id)})`)
  check(names(t1) === `${label} (70%)`, `${label} 1전이 (${names(t1)})`)
  check(names(t2) === `${label} (49%)`, `${label} 2전이 (${names(t2)})`)
  check(transferMultOf(id) === 1 && near(transferMultOf(t1), 0.7) && near(transferMultOf(t2), 0.49), `${label} 배율 1 / 0.7 / 0.49`)
  check(baseSkillId(t1) === id && baseSkillId(t2) === id, `${label} 기본 id 왕복`)
}

console.log('스턴 겹침 (바이퍼 에너지 오브)')
const t2Stun = variantSkillId(variantSkillId(5121002, 'transfer2'), 'stun')
check(damageSkillsForJob('viper').some((s) => s.id === t2Stun), '에너지 오브 (49%) (스턴) 항목 존재')
check(variantKindsOf(t2Stun).join() === 'stun,transfer2', `겹친 변형 종류 (${variantKindsOf(t2Stun).join()})`)
check(baseSkillId(t2Stun) === 5121002 && near(transferMultOf(t2Stun), 0.49), '겹친 변형 왕복·배율')
const t1Stun = variantSkillId(variantSkillId(5121002, 'transfer1'), 'stun')
check(variantKindsOf(t1Stun).join() === 'stun,transfer1' && near(transferMultOf(t1Stun), 0.7), '1전이 + 스턴')

console.log('다른 스킬 영향 없음')
check(transferMultOf(2221001) === 1 && chargeMultOf(variantSkillId(2221006, 'transfer1')) === 1, '빅뱅 전이 1 · 체인 전이 차징 1')
check(!damageSkillsForJob('archMageFP').some((s) => baseSkillId(s.id) === 2221006), '불독에는 체인 라이트닝 없음')

console.log(fail ? `\n실패 ${fail}건` : '\n전부 통과')
process.exit(fail ? 1 : 0)
