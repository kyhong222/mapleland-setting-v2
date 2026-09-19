/**
 * '내 문의' — 내가 남긴 문의와 운영자 답변. docs/feedback.md §4
 *
 * 서비스를 가리지 않는다. 스킬 시뮬에서 남긴 문의도 같은 계정이면 여기 함께 나온다.
 */

import { useCallback, useEffect, useState } from 'react'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import FeedbackItem from './common/FeedbackItem'
import { listMyFeedbacks, listReplies, type Feedback, type FeedbackReply } from '../data/cloud/feedback'
import { useAuthStore } from '../store/authStore'

export default function MyFeedbackDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const userId = useAuthStore((s) => s.user?.id)
  const [items, setItems] = useState<Feedback[]>([])
  const [replies, setReplies] = useState<Map<string, FeedbackReply[]>>(new Map())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      const list = await listMyFeedbacks(userId)
      setItems(list)
      setReplies(await listReplies(list.map((f) => f.id)))
    } catch (e) {
      setError(e instanceof Error ? e.message : '문의를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>내 문의</DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Stack alignItems="center" sx={{ py: 3 }}>
            <CircularProgress size={28} />
          </Stack>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : items.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            아직 남긴 문의가 없습니다.
          </Typography>
        ) : (
          <Stack spacing={1.5}>
            {items.map((f) => (
              <FeedbackItem key={f.id} feedback={f} replies={replies.get(f.id) ?? []} />
            ))}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => void load()} disabled={loading}>
          새로고침
        </Button>
        <Button onClick={onClose}>닫기</Button>
      </DialogActions>
    </Dialog>
  )
}
