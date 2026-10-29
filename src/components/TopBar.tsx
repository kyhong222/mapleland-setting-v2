import { useState } from 'react'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Badge from '@mui/material/Badge'
import { JOBS } from '../domain/jobs'
import { NOTICES, isNoticeExpired } from '../data/notices'
import { useBuildStore } from '../store/buildStore'
import { useUiStore } from '../store/uiStore'
import { resetAll } from '../store/snapshot'
import SlotManager from './SlotManager'
import FeedbackDialog from './FeedbackDialog'
import AuthButton from './AuthButton'
import ColorModeButton from './ColorModeButton'
import NoticeDialog from './notice/NoticeDialog'

export default function TopBar() {
  const jobId = useBuildStore((s) => s.jobId)
  const seenNotices = useUiStore((s) => s.seenNotices)
  const [slotsOpen, setSlotsOpen] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [noticeOpen, setNoticeOpen] = useState(false)
  // 아직 열어보지 않은(기간 내) 공지가 있으면 배지
  const hasUnseenNotice = NOTICES.some((n) => !isNoticeExpired(n) && !seenNotices.includes(n.id))

  const handleReset = () => {
    if (window.confirm('초기화하면 현재 작성 중인 내용과 개인 인벤토리가 사라집니다.\n공용 인벤토리는 유지됩니다. 계속할까요?')) {
      resetAll()
    }
  }

  return (
    <>
      {/* fixed: 모바일에서 sticky가 스크롤을 따라 흔들리는 문제 방지(확실히 상단 고정) */}
      <AppBar position="fixed" color="default" enableColorOnDark elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Toolbar sx={{ gap: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            메이플랜드 세팅
          </Typography>
          {jobId && <Chip size="small" color="primary" label={JOBS[jobId].label} />}
          <Box sx={{ flexGrow: 1 }} />
          <ColorModeButton />
          <Badge color="error" variant="dot" invisible={!hasUnseenNotice} overlap="rectangular">
            <Button variant="text" size="small" onClick={() => setNoticeOpen(true)}>
              공지사항
            </Button>
          </Badge>
          <Button variant="text" size="small" onClick={() => setFeedbackOpen(true)}>
            문의하기
          </Button>
          <Button variant="outlined" size="small" onClick={() => setSlotsOpen(true)}>
            저장 슬롯
          </Button>
          {jobId && (
            <Button variant="text" size="small" color="error" onClick={handleReset}>
              초기화
            </Button>
          )}
          <AuthButton />
        </Toolbar>
        <SlotManager open={slotsOpen} onClose={() => setSlotsOpen(false)} />
        <FeedbackDialog open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
        <NoticeDialog open={noticeOpen} onClose={() => setNoticeOpen(false)} />
      </AppBar>
      {/* fixed AppBar 높이만큼 콘텐츠를 밀어내는 스페이서 */}
      <Toolbar aria-hidden />
    </>
  )
}
