import Box from '@mui/material/Box'
import { useBuildStore } from './store/buildStore'
import JobSelectScreen from './components/JobSelectScreen'
import Dashboard from './components/Dashboard'

export default function App() {
  const jobId = useBuildStore((s) => s.jobId)
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {jobId ? <Dashboard /> : <JobSelectScreen />}
    </Box>
  )
}
