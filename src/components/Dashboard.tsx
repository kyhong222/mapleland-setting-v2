import Box from '@mui/material/Box'
import PanelGrid from './PanelGrid'

export default function Dashboard() {
  return (
    <Box sx={{ p: { xs: 1.5, md: 3 }, maxWidth: 1400, mx: 'auto' }}>
      <PanelGrid />
    </Box>
  )
}
