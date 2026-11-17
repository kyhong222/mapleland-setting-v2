/**
 * 수동 스모크 테스트: 다음 차징 확킬 (tsx) — domain/nhitProb.ts chargeFollowUp
 *  - 첫 시전 최솟값으로 이미 처치되면 oneShot
 *  - 확킬 최소 차징 = 두 시전 최솟값 합 ≥ HP인 가장 낮은 % (이분 탐색이 선형 탐색과 일치)
 *  - 풀차징으로도 최솟값 합이 모자라면 null
 *  - 표의 확률은 차징이 오를수록 줄지 않는다
 */
import { chargeFollowUp, uniformDist, distMin } from '../src/domain/nhitProb'
import type { Dist } from '../src/domain/nhitProb'

let fail = 0
const check = (ok: boolean, msg: string) => {
  if (!ok) fail++
  console.log(ok ? '  ✓' : '  ✗', msg)
}

// 풀차징 1회 = 8000~10000 균등. 차징 c% 시전 = 그 c/100배 (내림)
const full = uniformDist(8000, 10000, 10)
const at = (c: number): Dist => uniformDist(Math.floor(8000 * c / 100), Math.floor(10000 * c / 100), 10)
const PCTS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]

console.log('첫 시전으로 확킬')
check(chargeFollowUp(full, at, 7000, PCTS)?.oneShot === true, 'HP 7000 → oneShot')

console.log('확킬 최소 차징')
for (const hp of [9000, 12000, 14400, 16000]) {
  const r = chargeFollowUp(full, at, hp, PCTS)!
  let linear: number | null = null
  for (let c = 10; c <= 100; c++) if (distMin(full) + distMin(at(c)) >= hp) { linear = c; break }
  check(r.sureMin === linear, `HP ${hp} → ${r.sureMin}% (선형 ${linear}%)`)
  const mono = r.table.every((t, i) => i === 0 || t.prob >= r.table[i - 1].prob - 1e-12)
  check(mono, `HP ${hp} 표 확률 단조 증가`)
  if (r.sureMin != null) {
    const row = r.table.find((t) => t.pct >= r.sureMin!)
    check(!row || row.prob > 0.999999, `HP ${hp} 확킬 차징 이상은 확률 100%`)
  }
}
check(chargeFollowUp(full, at, 16001, PCTS)?.sureMin === null, 'HP 16001 → 풀차징으로도 불가')

console.log(fail ? `\n실패 ${fail}건` : '\n전부 통과')
process.exit(fail ? 1 : 0)
