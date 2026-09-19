/**
 * 문의 한 건 + 답변 목록. '내 문의'와 '문의 관리'가 같은 생김새를 쓴다.
 * docs/feedback.md §4
 *
 * 어드민 조작(답변 작성·상태 변경·공개 토글)은 children으로 받는다.
 */

import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import type { Feedback, FeedbackReply, FeedbackStatus, FeedbackType } from '../../data/cloud/feedback'

export const TYPE_LABEL: Record<FeedbackType, string> = {
  bug: '🐛 버그 제보',
  idea: '💡 기능 건의',
  etc: '💬 기타',
}

export const STATUS_LABEL: Record<FeedbackStatus, string> = {
  open: '접수됨',
  answered: '답변 완료',
  resolved: '처리 완료',
  wontfix: '반영 안 함',
}

const STATUS_COLOR: Record<FeedbackStatus, 'default' | 'info' | 'success' | 'warning'> = {
  open: 'default',
  answered: 'info',
  resolved: 'success',
  wontfix: 'warning',
}

interface Props {
  feedback: Feedback
  replies: FeedbackReply[]
  /** 어드민 화면에서만 작성자를 보여준다 */
  showAuthor?: boolean
  children?: ReactNode
}

export default function FeedbackItem({ feedback: f, replies, showAuthor, children }: Props) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap', mb: 0.5 }}>
        <Chip size="small" label={TYPE_LABEL[f.type]} variant="outlined" />
        <Chip size="small" label={STATUS_LABEL[f.status]} color={STATUS_COLOR[f.status]} />
        {f.isPublic && <Chip size="small" label="공개" color="secondary" variant="outlined" />}
        <Box sx={{ flexGrow: 1 }} />
        <Typography variant="caption" color="text.disabled">
          {new Date(f.createdAt).toLocaleString('ko-KR')}
        </Typography>
      </Box>

      <Typography sx={{ fontWeight: 700 }}>{f.title}</Typography>
      {showAuthor && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          {f.authorName ?? '(이름 없음)'} · {f.appId}
        </Typography>
      )}

      {/* 줄바꿈을 살려서 그대로 보여준다 */}
      <Typography variant="body2" sx={{ mt: 0.75, whiteSpace: 'pre-wrap' }}>
        {f.body}
      </Typography>

      {replies.map((r) => (
        <Box
          key={r.id}
          sx={{ mt: 1, pl: 1.5, borderLeft: 3, borderColor: 'primary.main', bgcolor: 'action.hover', py: 0.75, pr: 1 }}
        >
          <Typography variant="caption" color="primary" sx={{ fontWeight: 700 }}>
            운영자 답변 · {new Date(r.createdAt).toLocaleString('ko-KR')}
          </Typography>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
            {r.body}
          </Typography>
        </Box>
      ))}

      {children}
    </Paper>
  )
}
