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

  // ── 마법(무기 공속 무관, 노말/매직부스터 2값) docs §12.6 ──
  2211002: { type: 'magic', normal: 57, booster: 64 }, // 아이스 스트라이크
  2211003: { type: 'magic', normal: 45, booster: 53 }, // 썬더 스피어
  2111006: { type: 'magic', normal: 67, booster: 74 }, // 매직 컴포지션(FP)
  2211006: { type: 'magic', normal: 67, booster: 74 }, // 매직 컴포지션(IL)
  2111003: { type: 'magic', normal: 40, booster: 45 }, // 포이즌 미스트
  2121006: { type: 'magic', normal: 74, booster: 83 }, // 페럴라이즈
  2221006: { type: 'magic', normal: 77, booster: 87 }, // 체인 라이트닝
  2121001: { type: 'magic', normal: 62, booster: 73 }, // 빅뱅(FP)
  2221001: { type: 'magic', normal: 62, booster: 73 }, // 빅뱅(IL)
  2321001: { type: 'magic', normal: 62, booster: 73 }, // 빅뱅(클레릭)
  2121007: { type: 'magic', normal: 17, booster: 19 }, // 메테오(FP)
  12111003: { type: 'magic', normal: 17, booster: 19 }, // 메테오(플위)
  2221007: { type: 'magic', normal: 17, booster: 19 }, // 블리자드
  // 페럴라이즈 동일(74/83): 매직클로·에너지볼트·파이어에로우·포이즌브레스·콜드빔·썬더볼트·홀리에로우·파이어/아이스데몬
  2001005: { type: 'magic', normal: 74, booster: 83 }, // 매직 클로(2차)
  12001003: { type: 'magic', normal: 74, booster: 83 }, // 매직 클로(플위)
  2001004: { type: 'magic', normal: 74, booster: 83 }, // 에너지 볼트
  2101004: { type: 'magic', normal: 74, booster: 83 }, // 파이어 에로우(FP)
  12101002: { type: 'magic', normal: 74, booster: 83 }, // 파이어 에로우(플위)
  2101005: { type: 'magic', normal: 74, booster: 83 }, // 포이즌 브레스
  2201004: { type: 'magic', normal: 74, booster: 83 }, // 콜드 빔
  2201005: { type: 'magic', normal: 74, booster: 83 }, // 썬더 볼트
  2301005: { type: 'magic', normal: 74, booster: 83 }, // 홀리 에로우
  2121003: { type: 'magic', normal: 74, booster: 83 }, // 파이어 데몬
  2221003: { type: 'magic', normal: 74, booster: 83 }, // 아이스 데몬
  // 마법 고정(공속·부스터 무관) docs §12.1
  2311004: { type: 'fixed', apm: 57 }, // 샤이닝 레이
  2321007: { type: 'fixed', apm: 74 }, // 엔젤레이
  2321008: { type: 'fixed', apm: 22 }, // 제네시스

  // ── 물리 고정(무기 공속 무관) docs §12.1 ──
  3121004: { type: 'fixed', apm: 500 }, // 폭풍의 시(사수)
  13111002: { type: 'fixed', apm: 500 }, // 폭풍의 시(윈드아처)
  3221001: { type: 'fixed', apm: 21 }, // 피어싱(풀차징)
  13111006: { type: 'fixed', apm: 21 }, // 윈드 피어싱
  4111003: { type: 'fixed', apm: 74 }, // 쉐도우 웹(도적)
  14111001: { type: 'fixed', apm: 74 }, // 쉐도우 웹(나이트워커)
  4121008: { type: 'fixed', apm: 42 }, // 닌자 스톰
  5121005: { type: 'fixed', apm: 45 }, // 스내치
  5211004: { type: 'fixed', apm: 57 }, // 파이어 버너
  5211005: { type: 'fixed', apm: 57 }, // 쿨링 이펙트

  // ── 물리 고유 곡선 docs §12.2~12.3 ──
  1111008: { type: 'curve', apm: { 2: 52, 3: 49, 4: 45, 5: 42, 6: 40, 7: 37, 8: 35 } }, // 샤우트
  3211006: { type: 'curve', apm: { 2: 94, 3: 86, 4: 82, 5: 76, 6: 70 } }, // 스트레이프(석궁)
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
