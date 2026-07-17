/**
 * 몬스터 도메인.
 *
 * 데이터는 src/data/mobs/ JSON 두 소스를 합쳐 구성한다.
 *  - mobList.json   : 목록 메타(이름·레벨·보스여부·출현지)
 *  - mobWzData.json : 전투 수치(레벨·PA/MA/PDD/MDD·명중·회피·exp·HP·속성)
 *
 * 일부 몬스터는 전투 수치가 없을 수 있어(미믹·알리샤르 등) 해당 필드는 optional.
 */

/**
 * 원소 속성 코드 (WZ 표기 유지). "속성문자+단계" 쌍을 이어 붙인 문자열.
 *  - 속성문자: F(불) · I(얼음) · L(번개) · S(독) · H(성)
 *  - 단계 숫자: 1=무효 · 2=반감 · 3=약점
 *  - 예: "S1I2H3" = 독 무효 + 얼음 반감 + 성 약점. 무속성이면 undefined.
 */
export type ElementAttribute = string

const ELEM_NAME: Record<string, string> = { F: '불', I: '얼음', L: '번개', S: '독', H: '성' }
const ELEM_EFFECT: Record<string, '무효' | '반감' | '약점'> = { '1': '무효', '2': '반감', '3': '약점' }

/** 속성 한 항목: 속성명 + 효과(무효/반감/약점) */
export interface ElemEntry {
  /** 속성 문자 코드 (F/I/L/S/H) */
  code: string
  /** 속성명 (불/얼음/번개/독/성) */
  element: string
  /** 효과 */
  effect: '무효' | '반감' | '약점'
}

/** elemAttr 문자열을 속성 항목 배열로 파싱 ("S1I2" → [독 무효, 얼음 반감]) */
export function parseElemAttr(elemAttr?: string): ElemEntry[] {
  if (!elemAttr) return []
  const out: ElemEntry[] = []
  const re = /([A-Za-z])([0-9])/g
  let m: RegExpExecArray | null
  while ((m = re.exec(elemAttr))) {
    const code = m[1].toUpperCase()
    const element = ELEM_NAME[code]
    const effect = ELEM_EFFECT[m[2]]
    if (element && effect) out.push({ code, element, effect })
  }
  return out
}

/** 속성을 "독 무효, 얼음 반감" 형태 문자열로 (무속성이면 '무속성') */
export function formatElemAttr(elemAttr?: string): string {
  const e = parseElemAttr(elemAttr)
  return e.length ? e.map((x) => `${x.element} ${x.effect}`).join(', ') : '무속성'
}

/**
 * 몬스터 공격 스킬 (mobWzData.skills, attack1~4 등).
 * 스킬 키는 maplestory.io mob render 엔드포인트의 애니메이션 이름으로도 쓰인다.
 */
export interface MobSkill {
  /** 마법 스킬이면 1 */
  magic?: number
  /** 속성 코드 (F/I/L/S/H) */
  elemAttr?: string
  /** 물리 스킬 공격력 (물리 스킬만) */
  PADamage?: number
}

/** 단일 몬스터 (목록 메타 + 전투 수치 병합) */
export interface Monster {
  id: number
  /** 영문 원명 */
  name: string
  koreanName?: string
  level: number
  isBoss?: boolean
  /** 출현 지역 목록 */
  foundAt?: string[]

  // ── 전투 수치 (mobWzData 출처) ──
  maxHP?: number
  /** 물리 공격력 */
  PADamage?: number
  /** 마법 공격력 */
  MADamage?: number
  /** 물리 방어력 */
  PDDamage?: number
  /** 마법 방어력 */
  MDDamage?: number
  /** 명중치 */
  acc?: number
  /** 회피치 */
  eva?: number
  exp?: number
  elemAttr?: ElementAttribute
  /** 공격 스킬 (attack1~4 등) */
  skills?: Record<string, MobSkill>
}

/** 몬스터 아이콘 URL (maplestory.io mob 아이콘) */
export function monsterIconUrl(id: number): string {
  return `https://maplestory.io/api/gms/62/mob/${id}/icon`
}

/** 몬스터 표시명 (한글 우선, 없으면 영문) */
export function monsterLabel(m: Monster): string {
  return m.koreanName || m.name
}

/** 스킬 속성(F/I/L/S/H) 대비 몬스터 반응 (약점/반감/무효/무관) */
export function elementReaction(
  elemAttr: string | undefined,
  skillElement: string | undefined,
): 'weak' | 'half' | 'immune' | 'none' {
  if (!skillElement) return 'none'
  const entry = parseElemAttr(elemAttr).find((e) => e.code === skillElement.toUpperCase())
  if (!entry) return 'none'
  return entry.effect === '약점' ? 'weak' : entry.effect === '반감' ? 'half' : 'immune'
}
