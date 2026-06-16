import Chip from '@mui/material/Chip'
import type { GradeResult } from '../../domain/grade'

interface Props {
  grade: GradeResult
  showScore?: boolean
  size?: 'small' | 'medium'
}

/** 등급 색상 칩 */
export default function GradeBadge({ grade, showScore, size = 'small' }: Props) {
  const { info, score } = grade
  const dark = info.id === 'white' || info.id === 'yellow'
  return (
    <Chip
      size={size}
      label={showScore ? `${info.label} (${score})` : info.label}
      sx={{
        bgcolor: info.color,
        color: dark ? '#000' : '#fff',
        fontWeight: 700,
      }}
    />
  )
}
