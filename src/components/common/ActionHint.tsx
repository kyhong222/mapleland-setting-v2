import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

/**
 * 조작 안내 (좌클릭/우클릭/호버 등) — 한 줄 텍스트.
 * 별도 박스를 두지 않고 글자만으로 대비를 준다: 조작 이름은 굵게+강조색,
 * 설명은 본문색, 보조 설명만 흐리게.
 */
export interface HintAction {
  /** 조작 이름 (좌클릭 / 우클릭 / 호버 …) */
  key: string
  /** 그 조작이 하는 일 */
  desc: string
  /** 조작 이름 색 (기본 primary) */
  tone?: 'primary' | 'secondary' | 'default'
}

const TONE = {
  primary: 'primary.main',
  secondary: 'secondary.main',
  default: 'text.secondary',
} as const

export default function ActionHint({ actions, note, sx }: {
  actions: HintAction[]
  /** 뒤에 덧붙는 보조 설명 (예: 모바일 대체 조작) */
  note?: string
  sx?: object
}) {
  return (
    <Typography variant="body2" sx={{ display: 'block', color: 'text.secondary', ...sx }}>
      {actions.map((a, i) => (
        <Box component="span" key={a.key}>
          {i > 0 && <Box component="span" sx={{ mx: 0.75, opacity: 0.5 }}>·</Box>}
          <Box component="span" sx={{ fontWeight: 700, color: TONE[a.tone ?? 'primary'] }}>
            {a.key}
          </Box>
          <Box component="span" sx={{ color: 'text.primary', ml: 0.5 }}>{a.desc}</Box>
        </Box>
      ))}
      {note && (
        <Box component="span" sx={{ ml: 0.75, fontSize: 12, opacity: 0.8 }}>({note})</Box>
      )}
    </Typography>
  )
}
