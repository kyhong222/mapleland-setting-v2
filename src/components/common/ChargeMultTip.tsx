import Box from '@mui/material/Box'
import InfoTip, { InfoTitle } from './InfoTip'
import { chargeBreakdown } from '../../domain/paladinCharge'
import type { ChargeState, ChargeTerm } from '../../domain/paladinCharge'

/** 속성 반응 표기 */
const REACTION_LABEL: Record<ChargeTerm['reaction'], string> = {
  weak: '약점',
  half: '반감',
  immune: '무효',
  none: '무반응',
}

/** 배율 → 퍼센트 문자열 (1.625 → '162.5%'). 소수 꼬리는 잘라 표기 */
const pct = (v: number): string => `${+(v * 100).toFixed(2)}%`

/**
 * 항 하나의 계산식.
 *  주차지    : 150% × 약점 1.50 = 225%
 *  보조(약점): 125% × 약점 1.50 − 100% = 87.5%
 *  보조(그외): (125% − 100%) × 0.5 × 무반응 1.00 = 12.5%
 */
function termFormula(t: ChargeTerm): string {
  const attr = `${REACTION_LABEL[t.reaction]} ${t.attrMult.toFixed(2)}`
  const d = pct(t.damagePercent / 100)
  if (t.role === 'main') return `${d} × ${attr} = ${pct(t.value)}`
  return t.halved
    ? `(${d} − 100%) × 0.5 × ${attr} = ${pct(t.value)}`
    : `${d} × ${attr} − 100% = ${pct(t.value)}`
}

/**
 * 차지배율 계산 근거 툴팁 ('?' 배지).
 * 주차지·보조차지 각 항이 어떻게 나왔고 어떻게 더해져 총배율이 되는지 보여준다.
 *
 * @param target 대상 표기. 몬스터 미선택이면 '무속성 몹 기준'처럼 넘긴다.
 */
export default function ChargeMultTip({ state, elemAttr, target }: {
  state: ChargeState
  elemAttr: string | undefined
  target: string
}) {
  const { terms, total } = chargeBreakdown(state, elemAttr)
  return (
    <InfoTip
      maxWidth={400}
      title={
        <>
          <InfoTitle>차지배율 · {target}</InfoTitle>
          {terms.map((t) => (
            <Box key={t.role} sx={{ display: 'flex', gap: 0.75 }}>
              <Box sx={{ flexShrink: 0, color: t.role === 'assist' ? 'text.secondary' : undefined }}>
                {t.label}{t.role === 'assist' ? '(보조)' : ''}
              </Box>
              <Box sx={{ fontFamily: 'monospace' }}>{termFormula(t)}</Box>
            </Box>
          ))}
          <Box sx={{ mt: 0.5, pt: 0.5, borderTop: '1px solid rgba(255,255,255,0.2)', fontFamily: 'monospace' }}>
            {terms.map((t) => pct(t.value)).join(' + ')} = ×{+total.toFixed(4)}
          </Box>
        </>
      }
    />
  )
}
