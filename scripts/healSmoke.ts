/**
 * 수동 스모크 테스트: 힐 회복량 (tsx)
 *  - v77 식 값, 대상 수에 따른 총량 증가 · 1인당 감소, 입력 보정
 *  - 스킬북 회복력% · 데미지 스킬 목록 미포함(추가스킬 후보가 되지 않게)
 *  - 대상 수의 저장/복원과 구버전 선택 복원
 */
const mem = new Map<string, string>()
;(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
}
const { clampHealTargets, healRecovery, healTargetMult } = await import('../src/domain/heal')
const { HEAL_SKILL_ID, skillNumAt, skillsForJob } = await import('../src/data/skills')
const { damageSkillsForJob, nhitSkillsForJob } = await import('../src/data/skills/variants')
const { useNhitStore } = await import('../src/store/nhitStore')

let fail = 0
const check = (ok: boolean, msg: string) => {
  if (!ok) fail++
  console.log(ok ? '  ✓' : '  ✗', msg)
}

console.log('회복량 식')
const one = healRecovery(800, 100, 1000, 300, 1)
// P: R=0 → 1000, R=159 → ⌊(182.85+100)×10⌋ = 2828
check(one.min === 3900 && one.max === 11029, `INT800 LUK100 마력1000 30레벨 1명 (${one.min} ~ ${one.max})`)
const six = healRecovery(800, 100, 1000, 300, 6)
// 총량 2828 × 2.8 × 3 = 23755.2 → 23755 / 6 = 3959
check(six.min === 1400 && six.max === 3959, `6명 1인당 (${six.min} ~ ${six.max})`)
const low = healRecovery(4, 10, 100, 10, 1)
check(low.min === low.max, 'INT 5 미만이면 난수 없음')
check(healTargetMult(1) === 1.3 && Math.abs(healTargetMult(6) - 2.8 / 6) < 1e-12, '1인당 배율 1명 1.3 · 6명 0.467')
for (let n = 2; n <= 6; n++) {
  const a = healRecovery(800, 100, 1000, 300, n - 1)
  const b = healRecovery(800, 100, 1000, 300, n)
  check(b.max < a.max && b.max * n > a.max * (n - 1), `${n}명: 1인당 감소 · 총량 증가`)
}
check([0, -1, NaN].every((v) => clampHealTargets(v) === 1) && clampHealTargets(9) === 6 && clampHealTargets(3.7) === 3, '대상 수 1~6 보정')

console.log('스킬 목록')
check(skillNumAt(HEAL_SKILL_ID, 1, 'hp') === 10 && skillNumAt(HEAL_SKILL_ID, 30, 'hp') === 300, '회복력 1레벨 10 · 30레벨 300')
check(skillsForJob('bishop').some((s) => s.id === HEAL_SKILL_ID), '비숍 스킬북에 힐')
check(!damageSkillsForJob('bishop').some((s) => s.id === HEAL_SKILL_ID), '데미지 스킬(추가스킬 후보)에는 없음')
check(nhitSkillsForJob('bishop').filter((s) => s.id === HEAL_SKILL_ID).length === 1, '비숍 선택 목록에 힐 1개')
check(!nhitSkillsForJob('archMageFP').some((s) => s.id === HEAL_SKILL_ID), '불독에는 없음')

console.log('저장/복원')
const st = useNhitStore.getState()
check(st.healTargets === 1, '기본 1명')
st.setSkill(HEAL_SKILL_ID, 30)
st.setHealTargets(4)
const snap = useNhitStore.getState().capture()
st.reset()
check(useNhitStore.getState().healTargets === 1, '초기화 시 1명')
st.restore(snap)
check(useNhitStore.getState().healTargets === 4, '복원 4명')
st.restore({ skillId: HEAL_SKILL_ID, skillLevel: 30, preCast: [] })
check(useNhitStore.getState().healTargets === 1, '구버전 선택은 1명')

console.log(fail ? `\n실패 ${fail}건` : '\n전부 통과')
process.exit(fail ? 1 : 0)
