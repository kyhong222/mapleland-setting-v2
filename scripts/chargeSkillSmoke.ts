/**
 * 수동 스모크 테스트: 차징 스킬 (tsx) — docs/nhit-dpm.md §4 "차징 스킬"
 *  - 빅뱅·피어싱·스크류 펀치: 기존 항목 → '(풀차징)' + '(최소 차징)' 두 항목
 *  - 최소 차징 배율 0.1, 풀차징 1
 *  - 겹친 변형(바이퍼 '(최소 차징) (스턴)') id 왕복·스턴 판정
 *  - 키다운 배율은 방어·크리 뒤, 클램프 앞에 곱한다
 *  - 다른 스킬에 영향 없음
 */
import {
  baseSkillId, CHARGE_SKILLS, chargeMultOf, damageSkillsForJob, stunHitRatio, variantKindOf, variantKindsOf, variantSkillId,
} from '../src/data/skills/variants'
import { lineFinalRange } from '../src/domain/skillCombat'
import type { JobId } from '../src/domain/jobs'

let fail = 0
const check = (ok: boolean, msg: string) => {
  if (!ok) fail++
  console.log(ok ? '  ✓' : '  ✗', msg)
}

console.log('항목 펼침')
const CASES: [JobId, number, string][] = [
  ['archMageFP', 2121001, '빅뱅'],
  ['archMageIL', 2221001, '빅뱅'],
  ['bishop', 2321001, '빅뱅'],
  ['marksman', 3221001, '피어싱'],
  ['viper', 5101004, '스크류 펀치'],
  ['striker', 15101003, '스크류 펀치'],
]
for (const [job, id, label] of CASES) {
  const list = damageSkillsForJob(job)
  const full = list.find((s) => s.id === id)
  const minId = variantSkillId(id, 'minCharge')
  const min = list.find((s) => s.id === minId)
  check(!!full && /\(풀차징\)/.test(full.description?.name ?? ''), `${job} ${label}: 기본 id는 '(풀차징)' (${full?.description?.name})`)
  check(!!min && /\(최소 차징\)/.test(min.description?.name ?? ''), `${job} ${label}: '(최소 차징)' 항목 (${min?.description?.name})`)
  check(!list.some((s) => s.id === id && !/\(풀차징\)/.test(s.description?.name ?? '')), `${job} ${label}: 이름 없는 기존 항목은 남지 않음`)
  check(chargeMultOf(id) === 1 && chargeMultOf(minId) === 0.1, `${job} ${label}: 배율 풀 1 / 최소 0.1`)
  check(baseSkillId(minId) === id, `${job} ${label}: 변형 id 왕복`)
}
check(CHARGE_SKILLS.size === 6, '차징 스킬 6종')

console.log('바이퍼 스크류 펀치 × 스턴')
const vList = damageSkillsForJob('viper')
const minStun = variantSkillId(variantSkillId(5101004, 'minCharge'), 'stun')
const fullStun = variantSkillId(5101004, 'stun')
const ms = vList.find((s) => s.id === minStun)
check(!!ms, `(최소 차징) (스턴) 항목 존재 (${ms?.description?.name})`)
check(!!vList.find((s) => s.id === fullStun), `(풀차징) (스턴) 항목 존재 (${vList.find((s) => s.id === fullStun)?.description?.name})`)
check(baseSkillId(minStun) === 5101004, `겹친 변형 id 왕복 (${minStun} → ${baseSkillId(minStun)})`)
check(variantKindsOf(minStun).join() === 'stun,minCharge', `겹친 변형 종류 (${variantKindsOf(minStun).join()})`)
check(chargeMultOf(minStun) === 0.1 && stunHitRatio(minStun, 20) === 1, '최소 차징 배율 + 스턴 가정 둘 다 적용')
check(minStun < 2 ** 31, 'int32 범위')
check(stunHitRatio(variantSkillId(5101004, 'minCharge'), 20) === 0, '스턴 없는 최소 차징은 스턴 미가정')

console.log('적용 위치 (방어·크리 뒤, 클램프 앞)')
// base 10000, 물리방어 1000(렙차 0): 풀 = (10000 - 1000×0.5) × 200% = 19000 → 최소 1900
const input = {
  base: { min: 10000, max: 10000 }, elementMult: 1, skillPercent: 200, damageMult: 1, critFactor: 1,
  defense: { kind: 'physical' as const, def: 1000, levelPenalty: 0 },
}
const full = lineFinalRange(input)
const min = lineFinalRange({ ...input, keydownMult: 0.1 })
check(full.max === 19000 && min.max === 1900, `max 풀 19000 / 최소 1900 (${full.max} / ${min.max})`)
// 방어 앞에 곱했다면 (1000 - 500) × 2 = 1000 이 나온다 — 그렇게 되면 안 된다
check(min.max !== 1000, '방어 앞 적용(1000)이 아님')
// 클램프 앞: 풀차징 원값 300000 → 199999 클램프, 최소 차징은 30000 (클램프 뒤에 곱하면 19999)
const big = lineFinalRange({ ...input, base: { min: 150500, max: 150500 }, defense: undefined, keydownMult: 0.1 })
check(big.max === 30100, `클램프 앞 적용 (${big.max} = 301000×0.1)`)

console.log('영향 없음')
check(chargeMultOf(5121007) === 1 && variantKindOf(5121007) === null, '피스트 등 다른 스킬 배율 1')
check(baseSkillId(variantSkillId(5121007, 'stun')) === 5121007, '기존 스턴 변형 왕복 그대로')

console.log(fail ? `\n실패 ${fail}건` : '\n전부 통과')
process.exit(fail ? 1 : 0)
