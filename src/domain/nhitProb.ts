/**
 * N방컷 확률 계산 코어 (docs/nhit-dpm.md §7).
 *
 * 한 타(라인)의 데미지는 [min,max] 균등분포(모션차가 있으면 2성분 혼합)로 본다.
 * 한 번 시전 = 라인 분포들의 합(컨볼루션). N방 = 시전 분포를 N회 컨볼루션.
 * "정확히 N방" = P(N타 합 ≥ HP) − P((N−1)타 합 ≥ HP).
 *
 * 분포는 이산 PMF로 표현: base(최소 데미지) + step 간격의 확률 배열 p[].
 */

/** 이산 확률질량함수. p[i] = 데미지 (base + i*step) 의 확률. Σp = 1. */
export interface Dist {
  base: number
  step: number
  p: number[]
}

/** 목표 bin 수(대략). 시전 분포를 이 정도로 이산화해 컨볼루션 비용을 제한. */
const TARGET_BINS = 400

/** [lo, hi] 균등분포를 이산화 (step 지정). lo>hi거나 폭 0이면 단일 bin. */
export function uniformDist(lo: number, hi: number, step: number): Dist {
  const a = Math.min(lo, hi)
  const b = Math.max(lo, hi)
  const n = Math.max(1, Math.round((b - a) / step) + 1)
  if (n === 1) return { base: Math.round(a), step, p: [1] }
  const p = new Array<number>(n).fill(1 / n)
  return { base: Math.round(a), step, p }
}

/** 여러 분포의 혼합 (가중치 weight, 같은 step으로 재격자화). */
export function mixtureDist(parts: { weight: number; dist: Dist }[]): Dist {
  const valid = parts.filter((x) => x.weight > 0 && x.dist.p.length > 0)
  if (valid.length === 0) return { base: 0, step: 1, p: [1] }
  if (valid.length === 1) return valid[0].dist
  const step = Math.min(...valid.map((x) => x.dist.step))
  const lo = Math.min(...valid.map((x) => x.dist.base))
  const hi = Math.max(...valid.map((x) => x.dist.base + (x.dist.p.length - 1) * x.dist.step))
  const n = Math.max(1, Math.round((hi - lo) / step) + 1)
  const p = new Array<number>(n).fill(0)
  const wsum = valid.reduce((s, x) => s + x.weight, 0)
  for (const { weight, dist } of valid) {
    const w = weight / wsum
    for (let i = 0; i < dist.p.length; i++) {
      const val = dist.base + i * dist.step
      const idx = Math.round((val - lo) / step)
      p[idx] += w * dist.p[i]
    }
  }
  return { base: lo, step, p }
}

/** 두 분포의 합(컨볼루션). step이 다르면 좌측 step으로 통일(재격자). */
export function convolve(a: Dist, b: Dist): Dist {
  const step = a.step
  // b를 a.step 격자로 재표현
  const bp = b.step === step ? b.p : reStep(b, step).p
  const bbase = b.step === step ? b.base : reStep(b, step).base
  const out = new Array<number>(a.p.length + bp.length - 1).fill(0)
  for (let i = 0; i < a.p.length; i++) {
    const ai = a.p[i]
    if (ai === 0) continue
    for (let j = 0; j < bp.length; j++) out[i + j] += ai * bp[j]
  }
  return { base: a.base + bbase, step, p: out }
}

/** 분포를 다른 step 격자로 재표현 */
function reStep(d: Dist, step: number): Dist {
  if (d.step === step) return d
  const lo = d.base
  const hi = d.base + (d.p.length - 1) * d.step
  const n = Math.max(1, Math.round((hi - lo) / step) + 1)
  const p = new Array<number>(n).fill(0)
  for (let i = 0; i < d.p.length; i++) {
    const val = lo + i * d.step
    p[Math.round((val - lo) / step)] += d.p[i]
  }
  return { base: lo, step, p }
}

/** 분포 기대값 */
export function expectedValue(d: Dist): number {
  let e = 0
  for (let i = 0; i < d.p.length; i++) e += (d.base + i * d.step) * d.p[i]
  return e
}

/** P(X ≥ threshold) */
export function tailProb(d: Dist, threshold: number): number {
  let s = 0
  for (let i = 0; i < d.p.length; i++) {
    if (d.base + i * d.step >= threshold) s += d.p[i]
  }
  return s
}

/**
 * 시전 데미지 분포로부터 "정확히 N방 처치" 확률 배열 [1..maxN].
 *  - result[k-1] = P(정확히 k방에 죽음)
 *  - CDF(k) = P(k타 누적 ≥ hp), 정확히 k = CDF(k) − CDF(k−1)
 *  - maxN 이후 잔여확률은 result에 포함되지 않음(초과 = "maxN+ 방").
 * cumulativeAbove: maxN 초과로 남은 확률(= 1 − CDF(maxN)).
 */
export function exactNProbabilities(castDist: Dist, hp: number, maxN: number, prior?: Dist): {
  exact: number[]
  cumulative: number[]
  over: number
  /** 추가타 0회(= prior만)로 처치될 확률 */
  zero: number
} {
  const exact: number[] = []
  const cumulative: number[] = []
  // 시작 누적 = 추가스킬(prior) 분포 또는 0타(delta at 0). prior는 매 타격마다 랜덤이므로 분포째 반영.
  const acc0: Dist = prior ? reStep(prior, castDist.step) : { base: 0, step: castDist.step, p: [1] }
  let acc = acc0
  const zero = tailProb(acc0, hp)
  let prevCdf = zero
  for (let k = 1; k <= maxN; k++) {
    acc = convolve(acc, castDist)
    const cdf = tailProb(acc, hp)
    exact.push(Math.max(0, cdf - prevCdf))
    cumulative.push(cdf)
    prevCdf = cdf
  }
  return { exact, cumulative, over: Math.max(0, 1 - prevCdf), zero }
}

/** [min,max]에서 bin 수를 TARGET_BINS 근처로 맞추는 step */
export function stepFor(min: number, max: number): number {
  const span = Math.max(0, max - min)
  return Math.max(1, Math.ceil(span / TARGET_BINS))
}
