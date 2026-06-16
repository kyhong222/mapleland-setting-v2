import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { EFFECTS, ALL_EFFECTS } from '../../domain/effects'
import type { EffectId, EffectMap } from '../../domain/effects'

const ORDER: EffectId[] = ALL_EFFECTS.map((e) => e.id)

interface Props {
  effects: EffectMap
  hideZero?: boolean
  dense?: boolean
}

/** EffectMap을 라벨+값 목록으로 표시 (정의 순서) */
export default function EffectList({ effects, hideZero = true, dense }: Props) {
  const ids = ORDER.filter((id) => {
    const v = effects[id]
    return v !== undefined && (!hideZero || v !== 0)
  })
  if (ids.length === 0) {
    return (
      <Typography variant="body2" color="text.disabled">
        효과 없음
      </Typography>
    )
  }
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        columnGap: 2,
        rowGap: dense ? 0.25 : 0.5,
      }}
    >
      {ids.map((id) => {
        const v = effects[id] as number
        const step = EFFECTS[id].unit === 'step'
        return (
          <Box key={id} sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" color="text.secondary">
              {EFFECTS[id].label}
            </Typography>
            <Typography
              variant="body2"
              sx={{ fontWeight: 600 }}
              color={!step && v < 0 ? 'error.main' : 'text.primary'}
            >
              {step ? v : `${v > 0 ? '+' : ''}${v}`}
            </Typography>
          </Box>
        )
      })}
    </Box>
  )
}
