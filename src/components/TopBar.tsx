import { useEffect, useRef, useState } from 'react'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Badge from '@mui/material/Badge'
import SvgIcon from '@mui/material/SvgIcon'
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
import ShareCardDialog from './share/ShareCardDialog'

export default function TopBar() {
  const jobId = useBuildStore((s) => s.jobId)
  const seenNotices = useUiStore((s) => s.seenNotices)
  const [slotsOpen, setSlotsOpen] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [noticeOpen, setNoticeOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  // 좁은 화면에선 버튼이 줄바꿈돼 헤더가 기본 툴바보다 높아진다 → 실측 높이로 스페이서를 맞춘다
  const barRef = useRef<HTMLDivElement>(null)
  const [barHeight, setBarHeight] = useState<number>()
  useEffect(() => {
    const el = barRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setBarHeight(el.offsetHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
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
      <AppBar ref={barRef} position="fixed" color="default" enableColorOnDark elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        {/* 좁은 화면: 줄바꿈 허용 + 버튼 글자는 한 줄로(글자가 접히며 헤더가 들쭉날쭉 높아지던 문제) */}
        <Toolbar
          sx={{
            gap: { xs: 1, sm: 2 },
            flexWrap: { xs: 'wrap', md: 'nowrap' },
            py: { xs: 1, md: 0 },
            '& .MuiButton-root': { whiteSpace: 'nowrap', flexShrink: 0 },
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 800, whiteSpace: 'nowrap' }}>
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
          {jobId && (
            <Button
              variant="outlined"
              size="small"
              onClick={() => setShareOpen(true)}
              startIcon={
                <SvgIcon fontSize="small">
                  {/* Material Icons "Share" */}
                  <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z" />
                </SvgIcon>
              }
            >
              공유하기
            </Button>
          )}
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
        <ShareCardDialog open={shareOpen} onClose={() => setShareOpen(false)} />
      </AppBar>
      {/* fixed AppBar 높이만큼 콘텐츠를 밀어내는 스페이서 (측정 전엔 기본 툴바 높이) */}
      {barHeight ? <Box aria-hidden sx={{ height: barHeight }} /> : <Toolbar aria-hidden />}
    </>
  )
}
