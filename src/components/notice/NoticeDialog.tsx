/**
 * 공지사항 — 제목 목록 ↔ 본문 한 화면씩.
 * 버튼으로 열면 목록부터, 시작 시 자동 노출은 해당 공지 본문부터 보여준다.
 */

import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import { NOTICES, isNoticeExpired } from '../../data/notices'
import { useUiStore } from '../../store/uiStore'
import NoticeBlocks from './NoticeBlocks'
import { useNoticeItems } from './NoticeItem'

interface Props {
  open: boolean
  onClose: () => void
  /** 바로 펼칠 공지 (없으면 목록부터) */
  initialId?: string
}

export default function NoticeDialog({ open, onClose, initialId }: Props) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const seen = useUiStore((s) => s.seenNotices)
  const dismissed = useUiStore((s) => s.dismissedNotices)
  const markSeen = useUiStore((s) => s.markNoticeSeen)
  const dismiss = useUiStore((s) => s.dismissNotice)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  useEffect(() => {
    if (open) setSelectedId(initialId ?? null)
  }, [open, initialId])

  const notice = NOTICES.find((n) => n.id === selectedId) ?? null
  const items = useNoticeItems(notice)

  useEffect(() => {
    if (open && notice) markSeen(notice.id)
  }, [open, notice, markSeen])

  const canDismiss = notice !== null && notice.autoOpen && !isNoticeExpired(notice) && !dismissed.includes(notice.id)

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" fullScreen={isMobile}>
      <DialogTitle sx={{ fontWeight: 800, pb: 1 }}>
        {notice ? notice.title : '공지사항'}
        {notice && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 400 }}>
            {notice.date}
          </Typography>
        )}
      </DialogTitle>
      <DialogContent dividers sx={notice ? undefined : { p: 0 }}>
        {notice ? (
          <NoticeBlocks blocks={notice.blocks} items={items} />
        ) : NOTICES.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
            공지가 없습니다.
          </Typography>
        ) : (
          <List disablePadding>
            {NOTICES.map((n) => {
              const unread = !seen.includes(n.id)
              return (
                <ListItemButton key={n.id} divider onClick={() => setSelectedId(n.id)}>
                  <ListItemText
                    primary={
                      <>
                        {unread && (
                          <Box component="span" sx={{ color: 'error.main', fontSize: 10, mr: 0.75, verticalAlign: 'middle' }}>
                            ●
                          </Box>
                        )}
                        {n.title}
                      </>
                    }
                    slotProps={{ primary: { sx: { fontWeight: unread ? 700 : 400 } } }}
                  />
                </ListItemButton>
              )
            })}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        {notice && <Button onClick={() => setSelectedId(null)}>목록</Button>}
        <Box sx={{ flexGrow: 1 }} />
        {canDismiss && (
          <Button
            color="inherit"
            onClick={() => {
              dismiss(notice.id)
              onClose()
            }}
          >
            다시 열지 않음
          </Button>
        )}
        <Button variant="contained" onClick={onClose}>
          닫기
        </Button>
      </DialogActions>
    </Dialog>
  )
}
