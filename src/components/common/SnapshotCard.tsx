/**
 * 빌드 스냅샷 카드 — 저장 슬롯 화면과 같은 생김새.
 * 이름 / [Lv. N] 직업 / 저장시각 / 장착 아이콘 줄 / 하단 액션.
 *
 * SlotManager의 카드를 '이 기기에서 불러오기'에서도 쓰려고 뺀 것이다. 액션 버튼만 다르므로
 * 그 자리를 children으로 비워 뒀다.
 */

import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import ItemIcon from './ItemIcon'
import type { PreviewItem } from '../../lib/slotPreview'

interface Props {
  title: string
  /** '[Lv. 120] 히어로' — 빈 카드에서는 생략 */
  subtitle?: string
  savedAt?: number
  preview?: PreviewItem[]
  /** 하단 액션 영역 */
  children: ReactNode
  /** 내용이 없는 칸 (가운데에 '비어있음') */
  empty?: boolean
}

export default function SnapshotCard({ title, subtitle, savedAt, preview, children, empty }: Props) {
  return (
    <Paper
      variant="outlined"
      sx={{ p: 1.25, minHeight: 176, display: 'flex', flexDirection: 'column', bgcolor: 'background.paper' }}
    >
      <Typography noWrap title={title} sx={{ fontSize: '1.05rem', fontWeight: 700, lineHeight: 1.3 }}>
        {title}
      </Typography>

      {empty ? (
        <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography variant="body2" color="text.disabled">
            비어있음
          </Typography>
        </Box>
      ) : (
        <>
          {subtitle && (
            <Typography color="text.secondary" sx={{ fontSize: '1rem', fontWeight: 500 }} noWrap title={subtitle}>
              {subtitle}
            </Typography>
          )}
          {savedAt !== undefined && savedAt > 0 && (
            <Typography variant="caption" color="text.disabled" noWrap>
              {new Date(savedAt).toLocaleString()}
            </Typography>
          )}
          {/* 이름은 hover 툴팁으로 빼고 아이콘만 한 줄에 늘어놓는다 */}
          <Box sx={{ mt: 0.75, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {(preview ?? []).map((e) => (
              <Box
                key={e.inst}
                title={`${e.label} · ${e.name} (${e.grade.info.label})`}
                sx={{ bgcolor: 'action.hover', borderRadius: 0.5, display: 'flex', flexShrink: 0 }}
              >
                {/* 등급은 인벤토리와 같은 방식으로 아이콘 윤곽선 색에 싣는다 */}
                <ItemIcon src={e.iconUrl} alt={e.name} size={30} outlineColor={e.grade.info.color} />
              </Box>
            ))}
          </Box>
          <Box sx={{ flexGrow: 1 }} />
        </>
      )}

      {children}
    </Paper>
  )
}
