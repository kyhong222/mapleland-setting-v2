/**
 * '문의 관리' — 어드민 전용. docs/feedback.md §5
 *
 * 메뉴 자체가 어드민에게만 보이지만, 그건 화면을 감추는 것일 뿐이다.
 * 실제 차단은 RLS가 한다 — 어드민이 아니면 목록에 본인 문의만 나오고 답변 작성은 실패한다.
 *
 * 앱 라우터가 없어 다이얼로그로 뒀다. 서비스가 늘어 문의를 한곳에서 볼 필요가 생기면
 * `data/cloud/feedback.ts`만 들고 나가면 된다(docs/feedback.md §6).
 */

import { useCallback, useEffect, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import FormControlLabel from '@mui/material/FormControlLabel'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import Switch from '@mui/material/Switch'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import FeedbackItem, { STATUS_LABEL } from './common/FeedbackItem'
import {
  createReply,
  listAllFeedbacks,
  listReplies,
  signImages,
  updateFeedback,
  type Feedback,
  type FeedbackReply,
  type FeedbackStatus,
} from '../data/cloud/feedback'
import { useAuthStore } from '../store/authStore'

const STATUSES: FeedbackStatus[] = ['open', 'answered', 'resolved', 'wontfix']

export default function AdminFeedbackDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const userId = useAuthStore((s) => s.user?.id)
  const [filter, setFilter] = useState<FeedbackStatus | 'all'>('open')
  const [items, setItems] = useState<Feedback[]>([])
  const [replies, setReplies] = useState<Map<string, FeedbackReply[]>>(new Map())
  const [imageUrls, setImageUrls] = useState<Map<string, string>>(new Map())
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await listAllFeedbacks(filter === 'all' ? undefined : filter)
      setItems(list)
      setReplies(await listReplies(list.map((f) => f.id)))
      setImageUrls(await signImages(list.flatMap((f) => f.images)))
    } catch (e) {
      setError(e instanceof Error ? e.message : '문의를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  const submitReply = async (f: Feedback) => {
    const body = (drafts[f.id] ?? '').trim()
    if (!body || !userId) return
    setBusyId(f.id)
    setError(null)
    try {
      await createReply(f.id, userId, body)
      setDrafts((d) => ({ ...d, [f.id]: '' }))
      await load() // 트리거가 상태를 answered로 올리므로 목록째 다시 읽는다
    } catch (e) {
      setError(e instanceof Error ? e.message : '답변 등록에 실패했습니다.')
    } finally {
      setBusyId(null)
    }
  }

  const patch = async (f: Feedback, body: { status?: FeedbackStatus; isPublic?: boolean }) => {
    setBusyId(f.id)
    setError(null)
    try {
      await updateFeedback(f.id, body)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '변경에 실패했습니다.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 800, pb: 1 }}>문의 관리</DialogTitle>
      <DialogContent dividers>
        <Stack direction="row" spacing={1} sx={{ mb: 1.5, alignItems: 'center' }}>
          <Select
            size="small"
            value={filter}
            onChange={(e) => setFilter(e.target.value as FeedbackStatus | 'all')}
            sx={{ minWidth: 140 }}
          >
            <MenuItem value="all">전체</MenuItem>
            {STATUSES.map((s) => (
              <MenuItem key={s} value={s}>
                {STATUS_LABEL[s]}
              </MenuItem>
            ))}
          </Select>
          <Typography variant="caption" color="text.secondary">
            {items.length}건
          </Typography>
        </Stack>

        {error && (
          <Alert severity="error" sx={{ mb: 1.5 }}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Stack alignItems="center" sx={{ py: 3 }}>
            <CircularProgress size={28} />
          </Stack>
        ) : items.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            해당하는 문의가 없습니다.
          </Typography>
        ) : (
          <Stack spacing={1.5}>
            {items.map((f) => (
              <FeedbackItem key={f.id} feedback={f} replies={replies.get(f.id) ?? []} imageUrls={imageUrls} showAuthor>
                <Box sx={{ mt: 1.25 }}>
                  <TextField
                    size="small"
                    fullWidth
                    multiline
                    minRows={2}
                    placeholder="답변 작성"
                    value={drafts[f.id] ?? ''}
                    onChange={(e) => setDrafts((d) => ({ ...d, [f.id]: e.target.value }))}
                    disabled={busyId === f.id}
                  />
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1}
                    sx={{ mt: 1, alignItems: { sm: 'center' } }}
                  >
                    <Button
                      size="small"
                      variant="contained"
                      disabled={busyId === f.id || !(drafts[f.id] ?? '').trim()}
                      onClick={() => void submitReply(f)}
                    >
                      답변 등록
                    </Button>
                    <Select
                      size="small"
                      value={f.status}
                      disabled={busyId === f.id}
                      onChange={(e) => void patch(f, { status: e.target.value as FeedbackStatus })}
                      sx={{ minWidth: 130 }}
                    >
                      {STATUSES.map((s) => (
                        <MenuItem key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </MenuItem>
                      ))}
                    </Select>
                    {/* 켜면 대문에 노출된다 — 작성자 닉네임도 함께 공개된다(docs/feedback.md §3) */}
                    <FormControlLabel
                      control={
                        <Switch
                          size="small"
                          checked={f.isPublic}
                          disabled={busyId === f.id}
                          onChange={(e) => void patch(f, { isPublic: e.target.checked })}
                        />
                      }
                      label={<Typography variant="body2">대문 공개</Typography>}
                    />
                  </Stack>
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
