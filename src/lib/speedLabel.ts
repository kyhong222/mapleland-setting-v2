/**
 * 공격속도 단계(2~9) 표기 헬퍼 — docs/nhit-dpm.md §12.
 *
 * 인게임 툴팁과 동일하게 단계값 대신 한글 라벨을 함께 보여준다.
 *   2~3 매우 빠름 · 4~5 빠름 · 6 보통 · 7~8 느림 · 9 매우 느림
 */

/** 공속 단계 → 한글 라벨 */
export function speedLabel(step: number): string {
  if (step <= 3) return '매우 빠름'
  if (step <= 5) return '빠름'
  if (step === 6) return '보통'
  if (step <= 8) return '느림'
  return '매우 느림'
}

/** 공속 단계 → "빠름(5)" 표기 */
export function formatSpeedStep(step: number): string {
  return `${speedLabel(step)}(${step})`
}
