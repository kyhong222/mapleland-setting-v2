/**
 * 공지사항 — 목록(공지가 2건 이상일 때) + 본문.
 * 데스크톱은 목록·본문을 나란히, 모바일은 목록 → 본문으로 전환한다.
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
  /** 처음 펼칠 공지 (없으면 최신. 모바일에서 공지가 여럿이면 목록부터) */
  initialId?: string
}

export default function NoticeDialog({ open, onClose, initialId }: Props) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const hasList = NOTICES.length > 1
  const seen = useUiStore((s) => s.seenNotices)
  const dismissed = useUiStore((s) => s.dismissedNotices)
  const markSeen = useUiStore((s) => s.markNoticeSeen)
  const dismiss = useUiStore((s) => s.dismissNotice)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  useEffect(() => {
    if (open) setSelectedId(initialId ?? (isMobile && hasList ? null : (NOTICES[0]?.id ?? null)))
    // isMobile은 열 때 한 번만 본다(회전으로 선택이 풀리지 않게)
  }, [open, initialId])

  const notice = NOTICES.find((n) => n.id === selectedId) ?? null
  const items = useNoticeItems(notice)

  useEffect(() => {
    if (open && notice) markSeen(notice.id)
  }, [open, notice, markSeen])

  const showList = hasList && (!isMobile || !notice)
  const showBody = notice !== null && (!isMobile || !showList)
  const canDismiss = notice !== null && notice.autoOpen && !isNoticeExpired(notice) && !dismissed.includes(notice.id)

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth={hasList ? 'md' : 'sm'} fullScreen={isMobile}>
      <DialogTitle sx={{ fontWeight: 800, pb: 1 }}>
        {showBody ? notice.title : '공지사항'}
        {showBody && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 400 }}>
            {notice.date}
          </Typography>
        )}
      </DialogTitle>
      <DialogContent dividers sx={{ display: 'flex', gap: 2, p: showList ? 0 : undefined }}>
        {showList && (
          <List dense disablePadding sx={{ width: isMobile ? '100%' : 220, flexShrink: 0, borderRight: isMobile ? 0 : 1, borderColor: 'divider' }}>
            {NOTICES.map((n) => (
              <ListItemButton key={n.id} selected={n.id === selectedId} onClick={() => setSelectedId(n.id)}>
                <ListItemText
                  primary={
                    <>
                      {!seen.includes(n.id) && !isNoticeExpired(n) && (
                        <Box component="span" sx={{ color: 'error.main', mr: 0.5 }}>
                          ●
                        </Box>
                      )}
                      {n.title}
                    </>
                  }
                  secondary={n.date}
                  slotProps={{ primary: { sx: { fontWeight: n.id === selectedId ? 700 : 400 } } }}
                />
              </ListItemButton>
            ))}
          </List>
        )}
        {showBody && (
          <Box sx={{ flex: 1, minWidth: 0, py: showList ? 2 : 0, pr: showList ? 2 : 0 }}>
            <NoticeBlocks blocks={notice.blocks} items={items} />
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        {isMobile && hasList && notice && <Button onClick={() => setSelectedId(null)}>목록</Button>}
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
