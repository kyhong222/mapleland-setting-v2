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
            <Button
              variant="outlined"
              size="small"
              onClick={() => setNoticeOpen(true)}
              startIcon={
                <SvgIcon fontSize="small">
                  {/* Material Icons "Campaign" (확성기) */}
                  <path d="M18 11v2h4v-2h-4zm-2 6.61c.96.71 2.21 1.65 3.2 2.39.4-.53.8-1.07 1.2-1.6-.99-.74-2.24-1.68-3.2-2.4-.4.54-.8 1.08-1.2 1.61zM20.4 5.6c-.4-.53-.8-1.07-1.2-1.6-.99.74-2.24 1.68-3.2 2.4.4.53.8 1.07 1.2 1.6.96-.72 2.21-1.65 3.2-2.4zM4 9c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2h1v4h2v-4h1l5 3V6L8 9H4zm11.5 3c0-1.33-.58-2.53-1.5-3.35v6.69c.92-.81 1.5-2.01 1.5-3.34z" />
                </SvgIcon>
              }
            >
              공지사항
            </Button>
          </Badge>
          <Button
            variant="outlined"
            size="small"
            onClick={() => setFeedbackOpen(true)}
            startIcon={
              <SvgIcon fontSize="small">
                {/* Material Icons "ChatBubbleOutline" (말풍선) */}
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
              </SvgIcon>
            }
          >
            문의하기
          </Button>
          {jobId && (
            <Button
              variant="outlined"
              size="small"
              onClick={() => setShareOpen(true)}
              startIcon={
                <SvgIcon fontSize="small">
                  {/* Material Icons "IosShare" (상자 + 위 화살표) */}
                  <path d="M16 5l-1.42 1.42-1.59-1.59V16h-1.98V4.83L9.42 6.42 8 5l4-4 4 4zm4 5v11c0 1.1-.9 2-2 2H6c-1.11 0-2-.9-2-2V10c0-1.11.89-2 2-2h3v2H6v11h12V10h-3V8h3c1.1 0 2 .89 2 2z" />
                </SvgIcon>
              }
            >
              공유하기
            </Button>
          )}
          <Button
            variant="outlined"
            size="small"
            onClick={() => setSlotsOpen(true)}
            startIcon={
              <SvgIcon fontSize="small">
                {/* Material Icons "SaveAlt" (받침 + 아래 화살표) — 공유하기의 위 화살표와 짝 */}
                <path d="M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zm-6 .67l2.59-2.58L17 11.5l-5 5-5-5 1.41-1.41L11 12.67V3h2z" />
              </SvgIcon>
            }
          >
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
