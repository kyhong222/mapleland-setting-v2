import Box from '@mui/material/Box'
import InfoTip, { InfoTitle } from './InfoTip'
import { chargeBreakdown } from '../../domain/paladinCharge'
import type { ChargeState, ChargeTerm } from '../../domain/paladinCharge'
import { elementName } from '../../domain/monster'

/** 속성 반응 표기 */
const REACTION_LABEL: Record<ChargeTerm['reaction'], string> = {
  weak: '약점',
  half: '반감',
  immune: '무효',
  none: '무반응',
}

/** 배율 → 퍼센트 문자열 (1.625 → '162.5%'). 소수 꼬리는 잘라 표기 */
const pct = (v: number): string => `${+(v * 100).toFixed(2)}%`

/** 속성배수 표기 — 무반응은 배수만, 그 외는 배수(반응). 소수 둘째 자리 0은 떼되 한 자리는 남긴다 */
function attrText(t: ChargeTerm): string {
  const n = t.attrMult.toFixed(2).replace(/0$/, '')
  return t.reaction === 'none' ? n : `${n}(${REACTION_LABEL[t.reaction]})`
}

/**
 * 항 하나의 계산식.
 *  주차지    : 150% × 1.5(약점) = 225%
 *  보조(약점): 125% × 1.5(약점) − 100% = 87.5%
 *  보조(그외): (125% − 100%) × 0.5 × 1.0 = 12.5%
 */
function termFormula(t: ChargeTerm): string {
  const d = pct(t.damagePercent / 100)
  const a = attrText(t)
  if (t.role === 'main') return `${d} × ${a} = ${pct(t.value)}`
  return t.halved
    ? `(${d} − 100%) × 0.5 × ${a} = ${pct(t.value)}`
    : `${d} × ${a} − 100% = ${pct(t.value)}`
}

/**
 * 차지배율 계산 근거 툴팁 ('?' 배지).
 * 주차지·보조차지 각 항이 어떻게 나왔고 어떻게 더해져 총배율이 되는지 보여준다.
 *
 * @param monsterName 대상 몬스터명(한글). 없으면 무속성 몹으로 간주해 표기한다.
 */
export default function ChargeMultTip({ state, elemAttr, monsterName }: {
  state: ChargeState
  elemAttr: string | undefined
  monsterName?: string
}) {
  const { terms, total } = chargeBreakdown(state, elemAttr)
  // 헤더: vs 스켈로스(성 약점) — 반응이 있는 속성만 나열
  const reacts = terms
    .filter((t) => t.reaction !== 'none')
    .map((t) => `${elementName(t.elementCode)} ${REACTION_LABEL[t.reaction]}`)
  const title = monsterName
    ? `vs ${monsterName}${reacts.length ? `(${reacts.join(', ')})` : ''}`
    : '무속성 몹 기준'

  return (
    <InfoTip
      maxWidth={400}
      title={
        <>
          <InfoTitle>{title}</InfoTitle>
          {terms.map((t) => (
            <Box key={t.role} sx={{ display: 'flex', gap: 0.75 }}>
              <Box sx={{ flexShrink: 0 }}>{t.label}{t.role === 'assist' ? '(보조)' : ''}</Box>
              <Box sx={{ fontFamily: 'monospace' }}>{termFormula(t)}</Box>
            </Box>
          ))}
          {/* 항이 하나뿐이면 '165% = 165%'가 되므로 합계 줄을 생략 */}
          {terms.length > 1 && (
            <Box sx={{ mt: 0.5, pt: 0.5, borderTop: '1px solid rgba(255,255,255,0.25)', fontFamily: 'monospace' }}>
              {terms.map((t) => pct(t.value)).join(' + ')} = {pct(total)}
            </Box>
          )}
        </>
      }
    />
  )
}
