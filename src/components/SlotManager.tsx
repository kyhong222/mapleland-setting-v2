import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import { JOBS } from '../domain/jobs'
import { useBuildStore } from '../store/buildStore'
import { useSlotsStore } from '../store/slotsStore'

interface Props {
  open: boolean
  onClose: () => void
}

export default function SlotManager({ open, onClose }: Props) {
  const slots = useSlotsStore((s) => s.slots)
  const save = useSlotsStore((s) => s.save)
  const clear = useSlotsStore((s) => s.clear)
  const snapshot = useBuildStore((s) => s.snapshot)
  const loadSnapshot = useBuildStore((s) => s.loadSnapshot)

  const handleSave = (i: number) => {
    const snap = snapshot()
    if (snap) save(i, snap)
  }
  const handleLoad = (i: number) => {
    const slot = slots[i]
    if (slot) {
      loadSnapshot(slot.snapshot)
      onClose()
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>저장 슬롯 (15)</DialogTitle>
      <DialogContent dividers>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)' },
            gap: 1.5,
          }}
        >
          {slots.map((slot, i) => (
            <Paper key={i} variant="outlined" sx={{ p: 1.5, minHeight: 120, display: 'flex', flexDirection: 'column' }}>
              <Typography variant="caption" color="text.secondary">
                슬롯 {i + 1}
              </Typography>
              {slot ? (
                <>
                  <Typography sx={{ fontWeight: 700, mt: 0.5 }}>
                    {JOBS[slot.snapshot.jobId].label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(slot.savedAt).toLocaleString()}
                  </Typography>
                  <Box sx={{ flexGrow: 1 }} />
                  <Stack direction="row" spacing={0.5} sx={{ mt: 1 }}>
                    <Button size="small" variant="contained" onClick={() => handleLoad(i)}>
                      불러오기
                    </Button>
                    <Button size="small" onClick={() => handleSave(i)}>
                      덮어쓰기
                    </Button>
                    <Button size="small" color="error" onClick={() => clear(i)}>
                      삭제
                    </Button>
                  </Stack>
                </>
              ) : (
                <>
                  <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography variant="caption" color="text.disabled">
                      비어있음
                    </Typography>
                  </Box>
                  <Button size="small" variant="outlined" onClick={() => handleSave(i)}>
                    현재 빌드 저장
                  </Button>
                </>
              )}
            </Paper>
          ))}
        </Box>
      </DialogContent>
    </Dialog>
  )
}
