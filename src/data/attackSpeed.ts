/**
 * 공속표 — 스킬 1회 시전 간격(ms). 근거: [docs/attack-speed.md](../../docs/attack-speed.md)
 *
 * 값을 분당횟수가 아니라 **ms**로 들고 있는다. 원자료가 ms이고 30ms(=30fps 1프레임) 배수로
 * 양자화돼 있어, apm으로 저장하면 반올림 오차가 생긴다(브랜디쉬 6속 840ms = 71.4회인데 72로 굳는 식).
 *
 * 곡선은 **스킬이 아니라 모션**에 붙는다 — 무기 계열이 달라도 같은 모션이면 8단계가 통째로 같다
 * (어벤져(아대) ≡ 브랜디쉬(검)). 그래서 곡선을 먼저 정의하고 스킬은 참조만 건다.
 *
 * 공속 단계: 2(최고속) ~ 9(최저속). 마법은 같은 인덱스를 **시전속도 단계**로 쓴다
 * (6 = 노말, 5 = 부스터1, 4 = 부스터2, 3·2 = 윈드 부스터 중첩 → docs/attack-speed.md §4-1 추정).
 */

/** 공속/시전속도 단계 → 시전 간격(ms). 빈 단계 = 해당 공속 무기가 없어 도달 불가 */
type SpeedCurve = Partial<Record<number, number>>

// ──────────────────────────────────────────────────────────────────────────
// 곡선 카탈로그 (docs/attack-speed.md §2)
// ──────────────────────────────────────────────────────────────────────────

/**
 * 평타 곡선 — 검·도끼·둔기 평타/파워 스트라이크/슬래시 블러스트/차지 블로우.
 * 미등록 물리 스킬의 기본값이기도 하다. 9속 값은 같은 곡선을 쓰는 Fury(드래곤 쓰레셔) 행에서 왔다
 * (원본 검 섹션은 8속까지만 측정됐다).
 *
 * 창/폴암 파워 스트라이크는 원본에서 60ms 빠르게 나오지만 채택하지 않는다 — §6-2 참고.
 */
export const BASIC_MS: SpeedCurve = { 2: 600, 3: 660, 4: 720, 5: 750, 6: 810, 7: 870, 8: 900, 9: 960 }

const CURVES = {
  basic: BASIC_MS,
  brandish: { 2: 630, 3: 690, 4: 750, 5: 810, 6: 840, 7: 900, 8: 960 },
  soulBlade: { 2: 750, 3: 810, 4: 870, 5: 930, 6: 990 },
  soulDriver: { 2: 1230, 3: 1350, 4: 1440, 5: 1530, 6: 1650 },
  crusherLow: { 2: 690, 3: 750, 4: 810, 5: 870, 6: 900, 7: 960, 8: 1020, 9: 1080 },
  crusherHigh: { 2: 810, 3: 870, 4: 930, 5: 990, 6: 1050, 7: 1140, 8: 1200, 9: 1260 },
  /**
   * 샤우트 — 원본에 행이 없어 메랜 실측(docs/nhit-dpm.md §12.2)을 그대로 쓴다.
   * 실측 apm(52·49·45·42·40·37·35)을 30ms 프레임에 스냅한 값이다. 드래곤 로어 곡선과
   * 5속(1440 vs 1410) 한 프레임 차이라 사실상 같은 모션으로 보인다.
   */
  shout: { 2: 1140, 3: 1230, 4: 1320, 5: 1440, 6: 1500, 7: 1620, 8: 1710 },
  // 활/석궁 — 활 계열은 평타 곡선과 같은 값이라 basic을 그대로 쓴다
  xbow: { 2: 630, 3: 690, 4: 720, 5: 780, 6: 870 },
  windShot: { 2: 960, 3: 1050, 4: 1110, 5: 1200, 6: 1260 },
  // 아대/단검
  avenger: { 2: 630, 3: 690, 4: 750, 5: 810, 6: 840 },
  vampire: { 2: 1020, 3: 1110, 4: 1200, 5: 1290, 6: 1350 },
  savage: { 2: 720, 3: 780, 4: 840, 5: 900 },
  assaulter: { 2: 900, 3: 990, 4: 1050, 5: 1140 },
  assassinate: { 2: 1380, 3: 1500, 4: 1620, 5: 1710 },
  // 너클
  straight: { 2: 450, 3: 510, 4: 540, 5: 570, 6: 600 },
  somersault: { 2: 660, 3: 720, 4: 780, 5: 840, 6: 840 },
  corkscrew: { 2: 660, 3: 720, 4: 780, 5: 840, 6: 840 }, // 써머솔트와 같은 행(적 없을 때) — §6-4
  backspin: { 2: 720, 3: 780, 4: 840, 5: 900, 6: 960 },
  doubleUpper: { 2: 1140, 3: 1140, 4: 1140, 5: 1140, 6: 1170 },
  shockwave: { 2: 1500, 3: 1620, 4: 1740, 5: 1860, 6: 1980 },
  demolition: { 2: 2340, 3: 2550, 4: 2730, 5: 2940, 6: 3120 },
  energyOrb: { 2: 930, 3: 990, 4: 1050, 5: 1140, 6: 1200 },
  sharkWave: { 2: 810, 3: 870, 4: 930, 5: 990, 6: 1050 },
  // 건
  gunDoubleShot: { 2: 390, 3: 420, 4: 450, 5: 480, 6: 480 },
  battleshipCannon: { 2: 600, 3: 630, 4: 690, 5: 750, 6: 780 },
  blankShot: { 2: 660, 3: 690, 4: 750, 5: 810, 6: 840 },
  invisibleShot: { 2: 630, 3: 660, 4: 720, 5: 750, 6: 810 },
  homing: { 2: 720, 3: 780, 4: 840, 5: 900, 6: 960 },
  // ── 마법(열 = 시전속도 단계). 2·3은 윈드 부스터 중첩 구간 추정치 — §4-1 ──
  magicBasic: { 2: 600, 3: 660, 4: 720, 5: 750, 6: 810 },
  magicChain: { 2: 600, 3: 630, 4: 690, 5: 750, 6: 780 },
  magicShiningRay: { 2: 810, 3: 870, 4: 930, 5: 990, 6: 1050 },
  magicPoisonMist: { 2: 1140, 3: 1230, 4: 1320, 5: 1410, 6: 1500 },
  magicFlameGear: { 2: 1080, 3: 1170, 4: 1260, 5: 1350, 6: 1440 },
  magicFireStrike: { 2: 660, 3: 720, 4: 750, 5: 810, 6: 870 },
  magicFirePillar: { 2: 900, 3: 990, 4: 1050, 5: 1140, 6: 1200 },
  magicElemComp: { 2: 690, 3: 750, 4: 810, 5: 870, 6: 900 },
  magicMeteor: { 2: 2640, 3: 2850, 4: 3060, 5: 3270, 6: 3480 },
  magicThunderSpear: { 2: 990, 3: 1080, 4: 1140, 5: 1230, 6: 1320 },
} satisfies Record<string, SpeedCurve>

type CurveId = keyof typeof CURVES

const curveOf = (id: CurveId): SpeedCurve => CURVES[id]

/**
 * 익스플로전 — 원작에서 유일하게 **무기 공속과 시전속도를 둘 다** 타는 스킬 (docs §6-1).
 * `[시전속도단계][무기공속단계]`. 차지 고정분이 커서 단계당 감소폭이 작아 표 밖으로 외삽하지 않는다.
 */
const EXPLOSION_MS: Record<number, SpeedCurve> = {
  4: { 4: 1500, 5: 1560, 6: 1620, 7: 1680, 8: 1710 }, // 부스터2
  5: { 4: 1620, 5: 1680, 6: 1740, 7: 1770, 8: 1830 }, // 부스터1
  6: { 4: 1710, 5: 1770, 6: 1800, 7: 1860, 8: 1920 }, // 노말
}

// ──────────────────────────────────────────────────────────────────────────
// 스킬 → 스펙
// ──────────────────────────────────────────────────────────────────────────

type SpeedSpec =
  /** 무기 공속 단계 의존 */
  | { type: 'curve'; curve: CurveId }
  /** 스킬 레벨로 곡선이 갈림 (버스터: 1~15 / 16~30) */
  | { type: 'byLevel'; upTo: number; low: CurveId; high: CurveId }
  /** 시전속도 단계 의존 (마법) */
  | { type: 'cast'; curve: CurveId }
  /** 공속 무관 고정 — 내부 딜레이가 있어 원자료가 spamming 값을 따로 적어 둔 스킬 (docs §5-1) */
  | { type: 'fixed'; ms: number }
  /** 익스플로전 전용 2차원 */
  | { type: 'explosion' }

/**
 * skill id → 공속 스펙. 미등록 물리는 `BASIC_MS`(평타 곡선), 미등록 마법은 데이터 없음(null).
 * 매핑 근거는 docs/attack-speed.md §3.
 */
export const SKILL_SPEED: Record<number, SpeedSpec> = {
  // ── 전사 ──
  1111008: { type: 'curve', curve: 'shout' }, // 샤우트
  1121008: { type: 'curve', curve: 'brandish' }, // 브랜디쉬
  1221009: { type: 'curve', curve: 'brandish' }, // 블래스트
  11111004: { type: 'curve', curve: 'brandish' }, // 브랜디쉬(소마)
  11101004: { type: 'curve', curve: 'soulBlade' }, // 소울 블레이드
  11111006: { type: 'curve', curve: 'soulDriver' }, // 소울 드라이버
  1311001: { type: 'byLevel', upTo: 15, low: 'crusherLow', high: 'crusherHigh' }, // 스피어 버스터
  1311002: { type: 'byLevel', upTo: 15, low: 'crusherLow', high: 'crusherHigh' }, // 폴암 버스터
  1311003: { type: 'curve', curve: 'basic' }, // 드래곤 쓰레셔 : 창
  1311004: { type: 'curve', curve: 'basic' }, // 드래곤 쓰레셔 : 폴암
  1311006: { type: 'fixed', ms: 2000 }, // 드래곤 로어 — 메랜 실측 30/분 유지 (docs §6 #1)

  // ── 마법사 (열 = 시전속도 단계) ──
  2001004: { type: 'cast', curve: 'magicBasic' }, // 에너지 볼트
  2001005: { type: 'cast', curve: 'magicBasic' }, // 매직 클로
  12001003: { type: 'cast', curve: 'magicBasic' }, // 매직 클로(플위)
  12001004: { type: 'cast', curve: 'magicBasic' }, // 플레임 — 원본 미수록, 매직 클로 계열 추정(§4-2)
  2101004: { type: 'cast', curve: 'magicBasic' }, // 파이어 에로우(FP)
  12101002: { type: 'cast', curve: 'magicBasic' }, // 파이어 에로우(플위)
  2101005: { type: 'cast', curve: 'magicBasic' }, // 포이즌 브레스
  2201004: { type: 'cast', curve: 'magicBasic' }, // 콜드 빔
  2201005: { type: 'cast', curve: 'magicBasic' }, // 썬더 볼트
  2121003: { type: 'cast', curve: 'magicBasic' }, // 파이어 데몬
  2221003: { type: 'cast', curve: 'magicBasic' }, // 아이스 데몬
  2121006: { type: 'cast', curve: 'magicBasic' }, // 페럴라이즈
  2301005: { type: 'cast', curve: 'magicBasic' }, // 홀리 에로우
  2321007: { type: 'cast', curve: 'magicBasic' }, // 엔젤레이 — 비숍은 매직부스터가 없어 4단계까지만 (§6-3)
  2111003: { type: 'cast', curve: 'magicPoisonMist' }, // 포이즌 미스트
  2111006: { type: 'cast', curve: 'magicElemComp' }, // 매직 컴포지션(FP)
  2211006: { type: 'cast', curve: 'magicElemComp' }, // 매직 컴포지션(IL)
  2211002: { type: 'cast', curve: 'magicShiningRay' }, // 아이스 스트라이크
  2311004: { type: 'cast', curve: 'magicShiningRay' }, // 샤이닝 레이
  2211003: { type: 'cast', curve: 'magicThunderSpear' }, // 썬더 스피어
  2221006: { type: 'cast', curve: 'magicChain' }, // 체인 라이트닝
  2121007: { type: 'cast', curve: 'magicMeteor' }, // 메테오(FP)
  12111003: { type: 'cast', curve: 'magicMeteor' }, // 메테오(플위)
  2221007: { type: 'cast', curve: 'magicMeteor' }, // 블리자드
  12101006: { type: 'cast', curve: 'magicFirePillar' }, // 파이어 필라
  12111005: { type: 'cast', curve: 'magicFlameGear' }, // 플레임 기어
  12111006: { type: 'cast', curve: 'magicFireStrike' }, // 파이어 스트라이크
  2321008: { type: 'fixed', ms: 2700 }, // 제네시스 — 원본에 Regular 한 값뿐(부스터 무반응)
  2111002: { type: 'explosion' }, // 익스플로전

  // ── 궁수 ──
  // 활 계열(스트레이프·에로우 레인·파이어 샷·애로우 봄·애로우 블로우·더블 샷)은 평타 곡선과 동일 → 미등록 폴백
  3201005: { type: 'curve', curve: 'xbow' }, // 아이언 에로우 : 석궁
  3211003: { type: 'curve', curve: 'xbow' }, // 아이스 샷
  3211004: { type: 'curve', curve: 'xbow' }, // 에로우 이럽션
  3211006: { type: 'curve', curve: 'xbow' }, // 스트레이프(신궁)
  13111007: { type: 'curve', curve: 'windShot' }, // 윈드 샷
  13111006: { type: 'fixed', ms: 2857 }, // 윈드 피어싱 — 실측 재확인까지 현행 유지 (docs §6 #8)
  3121004: { type: 'fixed', ms: 120 }, // 폭풍의 시 — 화살당 120ms 연사
  13111002: { type: 'fixed', ms: 120 }, // 폭풍의 시(윈브)
  13101005: { type: 'fixed', ms: 870 }, // 스톰 브레이크 — spamming 고정 (§5-1)

  // ── 도적 ──
  // 아대 계열(럭키 세븐·트리플 스로우·드레인·쉐도우 메소)은 평타 곡선과 동일 → 미등록 폴백
  4111005: { type: 'curve', curve: 'avenger' }, // 어벤져
  14111002: { type: 'curve', curve: 'avenger' }, // 어벤져(나워)
  14101006: { type: 'curve', curve: 'vampire' }, // 뱀파이어
  4201005: { type: 'curve', curve: 'savage' }, // 새비지 블로우
  4211002: { type: 'curve', curve: 'assaulter' }, // 어썰터
  4221001: { type: 'curve', curve: 'assassinate' }, // 암살
  4121008: { type: 'fixed', ms: 1440 }, // 닌자 스톰 — spamming 고정
  4221007: { type: 'fixed', ms: 1950 }, // 부메랑 스탭 — spamming 고정

  // ── 해적(너클) ──
  5001001: { type: 'curve', curve: 'straight' }, // 스트레이트
  15001001: { type: 'curve', curve: 'straight' },
  5111004: { type: 'curve', curve: 'straight' }, // 에너지 드레인
  15111001: { type: 'curve', curve: 'straight' },
  5001002: { type: 'curve', curve: 'somersault' }, // 써머솔트 킥
  15001002: { type: 'curve', curve: 'somersault' },
  5101004: { type: 'curve', curve: 'corkscrew' }, // 스크류 펀치 — 적 없을 때 행 (§6-4)
  15101003: { type: 'curve', curve: 'corkscrew' },
  5101002: { type: 'curve', curve: 'backspin' }, // 백스핀 블로우 — delay 곡선 (§6-4)
  5101003: { type: 'curve', curve: 'doubleUpper' }, // 더블 어퍼 — 적 없을 때 행 (§6-4)
  5111006: { type: 'curve', curve: 'shockwave' }, // 쇼크웨이브
  15111003: { type: 'curve', curve: 'shockwave' },
  5121002: { type: 'curve', curve: 'energyOrb' }, // 에너지 오브
  5121004: { type: 'curve', curve: 'demolition' }, // 데몰리션
  15111007: { type: 'curve', curve: 'sharkWave' }, // 샤크 웨이브
  5111002: { type: 'fixed', ms: 1140 }, // 에너지 버스터 — spamming 고정
  15101005: { type: 'fixed', ms: 1140 },
  5121001: { type: 'fixed', ms: 2250 }, // 드래곤 스트라이크 — spamming 고정
  5121005: { type: 'fixed', ms: 1320 }, // 스내치 — spamming 고정
  5121007: { type: 'fixed', ms: 3240 }, // 피스트 — spamming 고정
  15111004: { type: 'fixed', ms: 3240 },

  // ── 해적(건) ──
  5001003: { type: 'curve', curve: 'gunDoubleShot' }, // 더블 파이어
  5201001: { type: 'curve', curve: 'invisibleShot' }, // 인비지블샷
  5201004: { type: 'curve', curve: 'blankShot' }, // 페이크샷
  5210000: { type: 'curve', curve: 'blankShot' }, // 트리플 파이어
  5211006: { type: 'curve', curve: 'homing' }, // 호밍
  5220011: { type: 'curve', curve: 'homing' }, // 어드벤스드 호밍
  5221008: { type: 'curve', curve: 'homing' }, // 배틀쉽 토르페도
  5221007: { type: 'curve', curve: 'battleshipCannon' }, // 배틀쉽 캐논
  5211004: { type: 'fixed', ms: 1050 }, // 파이어 버너 — spamming 고정
  5211005: { type: 'fixed', ms: 1050 }, // 쿨링 이펙트
  5201006: { type: 'fixed', ms: 2310 }, // 백스탭샷 — spamming 고정
  5221004: { type: 'fixed', ms: 120 }, // 래피드 파이어 — 탄당 120ms 연사
}

/**
 * 시전 간격을 정의하지 않는 스킬 — DPM을 산출하지 않는다 (docs/attack-speed.md §5-2, §6).
 * 미등록 물리 스킬은 평타 곡선으로 폴백되므로, 폴백이 명백히 틀리는 것들은 여기에 따로 적는다.
 * (방컷 확률은 공속과 무관하므로 계속 제공된다.)
 */
export const NO_SPEED_DATA = new Set([
  // 차징 기믹 — 원본(무차징)도 실측도 실전 시전 간격을 대표하지 못한다
  2121001, 2221001, 2321001, // 빅뱅(FP·IL·클레릭)
  3221001, // 피어싱
  // 원본 미수록 + 평타 폴백이 부적절 (설치·디버프·도트·이동기·패시브)
  1201006, // 위협
  1221011, // 생츄어리
  1311007, // 파워 크래쉬
  3101003, 3201003, // 파워 넉백
  3121003, 3221003, // 드래곤 펄스
  4120005, 4220005, 14110004, // 베놈
  4121004, 4221004, // 닌자 앰부쉬
  14100005, // 배니쉬
  14111006, // 포이즌 봄
  15111006, // 스파크
  5201002, // 스로잉봄 — 원본 주석: 폭발 시점 기준이라 측정 불가
  5220001, // 속성강화
  13101006, // 윈드워크
  5221003, // 에어 스트라이크 — delay만 측정되고 실반복 간격(spamming)이 없다
])

/** 스킬별 공속 계산에 필요한 문맥 */
export interface SpeedContext {
  /** 장착 주무기의 기본 공속(2~9) */
  weaponSpeedStep: number
  /** 물리 공속 상승 단계 합 (무기 부스터 + 윈드 부스터) */
  boosterSteps: number
  /** 매직(스펠) 부스터 단계 */
  castBoostSteps: number
  /** 윈드 부스터 단계 */
  windBoostSteps: number
  /** 스킬 레벨 (버스터의 1~15 / 16~30 분기용) */
  skillLevel: number
  kind: 'physical' | 'magic'
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(v)))

/** 최종 무기 공속 단계 (2~9) */
export function effectiveSpeedStep(ctx: SpeedContext): number {
  return clamp(ctx.weaponSpeedStep - ctx.boosterSteps, 2, 9)
}

/**
 * 최종 시전속도 단계 (2~6). 6 = 노말, 5 = 부스터1, 4 = 부스터2, 3·2 = 윈드 부스터 중첩.
 * 비숍은 매직 부스터가 없어 `castBoostSteps`가 0이라 자동으로 4단계까지만 내려간다.
 */
export function effectiveCastStep(ctx: SpeedContext): number {
  return clamp(6 - (ctx.castBoostSteps + ctx.windBoostSteps), 2, 6)
}

/** 곡선에서 단계를 읽되, 비어 있는 단계(해당 공속 무기 없음)는 평타 곡선으로 폴백 */
function readCurve(curve: SpeedCurve, step: number): number | undefined {
  return curve[step] ?? BASIC_MS[step]
}

/**
 * 스킬 1회 시전 간격(ms). 모르면 null.
 *
 * @param skillId 스킬 id (변형 스킬은 `baseSkillId()`로 되돌린 값)
 */
export function attackIntervalMs(skillId: number, ctx: SpeedContext): number | null {
  if (NO_SPEED_DATA.has(skillId)) return null
  const spec = SKILL_SPEED[skillId]
  if (!spec) {
    // 미등록: 물리는 평타 곡선, 마법은 데이터 없음
    return ctx.kind === 'physical' ? (BASIC_MS[effectiveSpeedStep(ctx)] ?? null) : null
  }
  switch (spec.type) {
    case 'fixed':
      return spec.ms
    case 'curve':
      return readCurve(curveOf(spec.curve), effectiveSpeedStep(ctx)) ?? null
    case 'byLevel': {
      const id = ctx.skillLevel <= spec.upTo ? spec.low : spec.high
      return readCurve(curveOf(id), effectiveSpeedStep(ctx)) ?? null
    }
    case 'cast':
      return curveOf(spec.curve)[effectiveCastStep(ctx)] ?? null
    case 'explosion': {
      // 시전속도 축은 스펠 부스터만, 무기 공속 축은 윈드 부스터만 태운다 (docs §6-1)
      const cast = clamp(6 - ctx.castBoostSteps, 4, 6)
      const weapon = clamp(ctx.weaponSpeedStep - ctx.windBoostSteps, 4, 8)
      return EXPLOSION_MS[cast]?.[weapon] ?? null
    }
  }
}

/** 분당 공격횟수. 모르면 null */
export function attacksPerMinute(skillId: number, ctx: SpeedContext): number | null {
  const ms = attackIntervalMs(skillId, ctx)
  if (ms == null || ms <= 0) return null
  return Math.round((60000 / ms) * 10) / 10
}
