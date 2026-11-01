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
import Typography from '@mui/material/Typography'
import FeedbackItem from './common/FeedbackItem'
import {
  listMyFeedbacks,
  listReplies,
  saveFeedbackSeenAt,
  signImages,
  type Feedback,
  type FeedbackReply,
} from '../data/cloud/feedback'
import { useAuthStore } from '../store/authStore'
import { isAfter, useUiStore } from '../store/uiStore'

export default function MyFeedbackDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const userId = useAuthStore((s) => s.user?.id)
  const [items, setItems] = useState<Feedback[]>([])
  const [replies, setReplies] = useState<Map<string, FeedbackReply[]>>(new Map())
  const [imageUrls, setImageUrls] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** 이번에 열기 전까지 확인했던 답변 시각 — 그 뒤에 달린 답변에 '새 답변'을 붙인다 */
  const [prevSeenAt, setPrevSeenAt] = useState<string | undefined>(undefined)
  const markFeedbackSeen = useUiStore((s) => s.markFeedbackSeen)

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      const list = await listMyFeedbacks(userId)
      const byFeedback = await listReplies(list.map((f) => f.id))
      setItems(list)
      setReplies(byFeedback)
      setImageUrls(await signImages(list.flatMap((f) => f.images)))
      // 화면에 실제로 보여준 답변까지만 확인 처리한다(클라이언트 시계 대신 서버 시각)
      const latest = [...byFeedback.values()].flat().reduce<string | null>(
        (m, r) => (m === null || isAfter(r.createdAt, m) ? r.createdAt : m),
        null,
      )
      if (latest) {
        markFeedbackSeen(userId, latest)
        void saveFeedbackSeenAt(userId, latest) // 다른 기기에서도 점이 꺼지게 계정에 남긴다
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '문의를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [userId, markFeedbackSeen])

  useEffect(() => {
    if (!open || !userId) return
    // 확인 처리 전 값을 잡아둔다 — 열려 있는 동안 '새 답변' 표시가 사라지지 않게
    setPrevSeenAt(useUiStore.getState().feedbackSeenAt[userId])
    void load()
  }, [open, userId, load])

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
              <FeedbackItem
                key={f.id}
                feedback={f}
                replies={replies.get(f.id) ?? []}
                imageUrls={imageUrls}
                hasNewReply={(replies.get(f.id) ?? []).some((r) => isAfter(r.createdAt, prevSeenAt))}
              />
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
