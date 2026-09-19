/**
 * '내 문의' — 내가 남긴 문의와 운영자 답변. docs/feedback.md §5
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
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import FeedbackItem from './common/FeedbackItem'
import {
  createReply,
  listMyFeedbacks,
  listReplies,
  signImages,
  type Feedback,
  type FeedbackReply,
} from '../data/cloud/feedback'
import { useAuthStore } from '../store/authStore'

export default function MyFeedbackDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const userId = useAuthStore((s) => s.user?.id)
  const [items, setItems] = useState<Feedback[]>([])
  const [replies, setReplies] = useState<Map<string, FeedbackReply[]>>(new Map())
  const [imageUrls, setImageUrls] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** 재문의 입력 (문의 id별) */
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      const list = await listMyFeedbacks(userId)
      setItems(list)
      setReplies(await listReplies(list.map((f) => f.id)))
      setImageUrls(await signImages(list.flatMap((f) => f.images)))
    } catch (e) {
      setError(e instanceof Error ? e.message : '문의를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  /** 이어서 문의하기 — 트리거가 상태를 '접수됨'으로 되돌려 어드민 목록에 다시 뜬다 */
  const submitReply = async (feedbackId: string) => {
    const text = (drafts[feedbackId] ?? '').trim()
    if (!text || !userId) return
    setBusyId(feedbackId)
    setError(null)
    try {
      await createReply(feedbackId, userId, text)
      setDrafts((d) => ({ ...d, [feedbackId]: '' }))
      await load() // 상태가 바뀌므로 목록째 다시 읽는다
    } catch (e) {
      setError(e instanceof Error ? e.message : '등록에 실패했습니다.')
    } finally {
      setBusyId(null)
    }
  }

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
              <FeedbackItem key={f.id} feedback={f} replies={replies.get(f.id) ?? []} imageUrls={imageUrls}>
                <Box sx={{ mt: 1.25 }}>
                  <TextField
                    size="small"
                    fullWidth
                    multiline
                    minRows={2}
                    placeholder="이어서 문의하기"
                    value={drafts[f.id] ?? ''}
                    onChange={(e) => setDrafts((d) => ({ ...d, [f.id]: e.target.value }))}
                    disabled={busyId === f.id}
                  />
                  <Button
                    size="small"
                    variant="outlined"
                    sx={{ mt: 1 }}
                    disabled={busyId === f.id || !(drafts[f.id] ?? '').trim()}
                    onClick={() => void submitReply(f.id)}
                  >
                    등록
                  </Button>
                </Box>
              </FeedbackItem>
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
