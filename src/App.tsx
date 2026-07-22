import Box from '@mui/material/Box'
import { Analytics } from '@vercel/analytics/react'
import { useBuildStore } from './store/buildStore'
import TopBar from './components/TopBar'
import JobSelectScreen from './components/JobSelectScreen'
import Dashboard from './components/Dashboard'

export default function App() {
  const jobId = useBuildStore((s) => s.jobId)
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <TopBar />
      {jobId ? <Dashboard /> : <JobSelectScreen />}
      <Analytics />
    </Box>
  )
}
