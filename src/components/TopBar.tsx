import { useState } from 'react'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import { JOBS } from '../domain/jobs'
import { useBuildStore } from '../store/buildStore'
import SlotManager from './SlotManager'

export default function TopBar() {
  const jobId = useBuildStore((s) => s.jobId)
  const reset = useBuildStore((s) => s.reset)
  const [slotsOpen, setSlotsOpen] = useState(false)

  const handleReset = () => {
    if (window.confirm('초기화하면 현재 작성 중인 내용이 사라집니다. 계속할까요?')) {
      reset()
    }
  }

  return (
    <AppBar position="sticky" color="default" enableColorOnDark elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
      <Toolbar sx={{ gap: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>
          메이플랜드 세팅
        </Typography>
        {jobId && <Chip size="small" color="primary" label={JOBS[jobId].label} />}
        <Box sx={{ flexGrow: 1 }} />
        <Button variant="outlined" size="small" onClick={() => setSlotsOpen(true)}>
          저장 슬롯
        </Button>
        <Button variant="text" size="small" color="error" onClick={handleReset}>
          초기화
        </Button>
      </Toolbar>
      <SlotManager open={slotsOpen} onClose={() => setSlotsOpen(false)} />
    </AppBar>
  )
}
