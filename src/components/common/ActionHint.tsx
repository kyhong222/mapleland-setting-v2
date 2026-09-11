import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

/**
 * 조작 안내 (좌클릭/우클릭/호버 등) — 조작 하나당 한 줄.
 * 별도 박스를 두지 않고 글자만으로 대비를 준다: 조작 이름은 굵게+강조색,
 * 설명은 본문색, 보조 설명만 흐리게.
 */
export interface HintAction {
  /**
   * 조작 이름 (좌클릭 / 우클릭 …). 실제 UI 요소(편집 배지 등)를 그대로 끼워 넣어도 된다.
   * 생략하면 desc가 '※ …' 보조 문장 한 줄로 흐리게 나간다
   * — 조작 이름으로 줄이면 오히려 못 알아듣는 안내에 쓴다.
   */
  key?: React.ReactNode
  /** 그 조작이 하는 일 */
  desc: string
  /** 조작 이름 색 (기본 primary) */
  tone?: 'primary' | 'secondary' | 'default'
  /** 그 조작의 보조 설명 — 같은 줄 뒤에 괄호로 붙는다 (예: 모바일 대체 조작) */
  note?: string
}

const TONE = {
  primary: 'primary.main',
  secondary: 'secondary.main',
  default: 'text.secondary',
} as const

export default function ActionHint({ actions, sx }: {
  actions: HintAction[]
  sx?: object
}) {
  return (
    <Box sx={{ color: 'text.secondary', ...sx }}>
      {actions.map((a, i) => (
        // 안내문은 고정 목록이라 인덱스 key로 충분하다 (key가 노드일 수 있어 값으로 쓸 수 없음)
        <Typography key={i} variant="body2" sx={{ display: 'block' }}>
          {a.key && (
            <Box component="span" sx={{ fontWeight: 700, color: TONE[a.tone ?? 'primary'] }}>
              {a.key}
            </Box>
          )}
          <Box
            component="span"
            sx={a.key
              ? { color: 'text.primary', ml: 0.5 }
              : { color: 'text.secondary', fontSize: 12, opacity: 0.8 }}
          >
            {a.key ? a.desc : `※ ${a.desc}`}
          </Box>
          {a.note && (
            <Box component="span" sx={{ ml: 0.75, fontSize: 12, opacity: 0.8 }}>({a.note})</Box>
          )}
        </Typography>
      ))}
    </Box>
  )
}
