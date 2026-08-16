/**
 * 공격 난수 순환 (docs/nhit-dpm.md §2.5).
 *
 * 원작 서버는 공격 1회에 난수를 7개만 미리 뽑아 배열에 담고, 판정할 때마다
 * 하나씩 꺼내 쓰다가 인덱스가 배열을 넘으면 `% 7`로 되돌아가 같은 값을 다시 쓴다.
 *
 *   unsigned int aRandom[7], nRndIdx = 0;
 *   #define PrepareNextRand() nRnd = aRandom[nRndIdx++ % 7]
 *
 * 타격 하나가 면역·명중·데미지·방어·크리 5개를 소비하므로 3타 이상은 7개로 모자라
 * 재활용이 일어나고, 서로 다른 판정이 같은 난수를 읽게 된다. 예를 들어 트리플 스로우는
 * 2번째 줄의 데미지 롤과 3번째 줄의 크리 판정이 같은 슬롯을 읽는다 —
 * 2줄 데미지가 범위 하단이면 3줄이 반드시 크리다.
 *
 * 각 난수 자체는 여전히 균등하고 크리 확률도 그대로라 평균·DPM은 변하지 않는다.
 * 바뀌는 것은 라인끼리의 상관뿐이고, 그 결과 시전 총 데미지의 분산이 줄어든다.
 *
 * 첫 타만 6개를 소비한다. 균일하게 5개씩 두면 3타에서 커플링이 2개 나와 실측과 어긋난다.
 *
 * 실측 근거:
 *  - 트스 3타 40회 — 2줄 데미지 → 3줄 크리, 예외 0건 (아카라이브 2026-08-16)
 *  - 피스트 6타 4시전 — 5줄 = 1줄 × 2 정확 + 크리 일치 (4/4), 커플링 5쌍 20/20
 *
 * 6타의 1줄·5줄은 21(= 7의 배수)번째 draw만큼 떨어져 다섯 판정이 전부 같은 슬롯이다.
 * 이 정렬은 "첫 타만 6개"에서만 나오므로 배치의 직접 증거다.
 */

/** 난수 배열 크기. 구현체 네 곳(mnwvs077·Rebirth95·kinoko·Edelstein)이 모두 7. */
export const SLOT_COUNT = 7

/** 첫 타가 소비하는 난수 개수 (관측 정합을 위해 +1) */
const DRAWS_FIRST = 6
/** 2번째 타 이후가 소비하는 난수 개수 (면역·명중·데미지·방어·크리) */
const DRAWS_REST = 5

/** 타격 내 소비 순서에서 데미지 롤의 위치 (면역0 명중1 데미지2 방어3 크리4) */
const DMG_OFFSET = 2
/** 타격 내 소비 순서에서 크리 판정의 위치 */
const CRIT_OFFSET = 4

export interface LineSlots {
  /** 데미지 롤이 읽는 슬롯 */
  dmg: number
  /** 크리 판정이 읽는 슬롯 */
  crit: number
}

/** 라인(타격)별 난수 슬롯 배치 */
export function lineSlots(lines: number): LineSlots[] {
  const out: LineSlots[] = []
  const n = Math.max(1, lines)
  for (let i = 0; i < n; i++) {
    const start = i === 0 ? 0 : DRAWS_FIRST + DRAWS_REST * (i - 1)
    out.push({
      dmg: (start + DMG_OFFSET) % SLOT_COUNT,
      crit: (start + CRIT_OFFSET) % SLOT_COUNT,
    })
  }
  return out
}

/** 크리 판정에 쓰이는 슬롯 목록(중복 제거). 이 슬롯 수만큼 경우의 수가 갈린다. */
export function critSlots(slots: LineSlots[]): number[] {
  return [...new Set(slots.map((s) => s.crit))]
}

/**
 * 데미지 롤이 다른 라인의 크리 판정과 같은 슬롯을 읽는 쌍 = 화면에서 관측되는 커플링.
 * (분포 계산에는 쓰지 않고, 진단·표시용)
 */
export function couplings(slots: LineSlots[]): { dmgLine: number; critLine: number }[] {
  const out: { dmgLine: number; critLine: number }[] = []
  slots.forEach((a, i) => {
    slots.forEach((b, j) => {
      if (i !== j && a.dmg === b.crit) out.push({ dmgLine: i, critLine: j })
    })
  })
  return out
}
