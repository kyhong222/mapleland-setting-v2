/**
 * 공속표 (분당 공격횟수) — docs/nhit-dpm.md §12.
 *
 * 대부분 스킬은 평타 모션 기반이라 canonical '평타 곡선'을 공유하고,
 * 고유 모션/고정/마법 스킬만 예외로 둔다.
 *
 * 공속 단계: 2(최고속)~9(최저속). 값 = 분당 공격횟수(apm).
 */

/** canonical 평타 곡선 (공속 2~9). 미매핑 물리 스킬 기본값. */
export const BASIC_APM: Record<number, number> = { 2: 100, 3: 90, 4: 83, 5: 80, 6: 74, 7: 69, 8: 67, 9: 63 }

/** apm 소스: 평타곡선 참조 | 자체 곡선 | 고정 | 마법(노말/부스터) */
type ApmSpec =
  | { type: 'basic' }
  | { type: 'curve'; apm: Partial<Record<number, number>> }
  | { type: 'fixed'; apm: number }
  | { type: 'magic'; normal: number; booster: number }

/** skill id → apm 스펙 (미등록 물리 = basic). docs §12 */
export const SKILL_APM: Record<number, ApmSpec> = {
  // 전사 고유 곡선
  1311006: { type: 'fixed', apm: 30 }, // 드래곤 로어(무기 공속 무관 ~30)
  // 버스터(스피어/폴암) — 자체 곡선
  1311001: { type: 'curve', apm: { 2: 74, 3: 69, 4: 66, 5: 61, 6: 59, 7: 53, 8: 50, 9: 48 } },
  1311002: { type: 'curve', apm: { 2: 74, 3: 69, 4: 66, 5: 61, 6: 59, 7: 53, 8: 50, 9: 48 } },
  // 브랜디쉬/블래스트
  1121008: { type: 'curve', apm: { 2: 95, 3: 87, 4: 80, 5: 74, 6: 72, 7: 67, 8: 63 } },
  11111004: { type: 'curve', apm: { 2: 95, 3: 87, 4: 80, 5: 74, 6: 72, 7: 67, 8: 63 } },
}

/** 최고속(2)~최저속(9)로 clamp */
function clampStep(step: number): number {
  return Math.max(2, Math.min(9, Math.round(step)))
}

/**
 * 분당 공격횟수 조회.
 * @param skillId 스킬 id
 * @param weaponSpeedStep 무기 기본 공속(2~9)
 * @param boosterSteps 공속상승 버프 단계감소(부스터 등, 양수)
 * @param kind 물리/마법
 * @param magicBooster 매직부스터 적용 여부(마법 스킬)
 * @returns 분당 공격횟수 (모르면 null)
 */
export function attacksPerMinute(
  skillId: number,
  weaponSpeedStep: number,
  boosterSteps: number,
  kind: 'physical' | 'magic',
  magicBooster: boolean,
): number | null {
  const spec = SKILL_APM[skillId]
  const step = clampStep(weaponSpeedStep - boosterSteps)

  if (spec) {
    switch (spec.type) {
      case 'fixed':
        return spec.apm
      case 'magic':
        return magicBooster ? spec.booster : spec.normal
      case 'curve':
        return spec.apm[step] ?? null
      case 'basic':
        return BASIC_APM[step]
    }
  }
  // 미등록: 물리는 평타곡선 기본, 마법은 데이터 없음
  if (kind === 'physical') return BASIC_APM[step]
  return null
}
