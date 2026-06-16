import Box from '@mui/material/Box'
import TopBar from './TopBar'
import PanelGrid from './PanelGrid'

export default function Dashboard() {
  return (
    <Box>
      <TopBar />
      <Box sx={{ p: { xs: 1.5, md: 3 }, maxWidth: 1400, mx: 'auto' }}>
        <PanelGrid />
      </Box>
    </Box>
  )
}
