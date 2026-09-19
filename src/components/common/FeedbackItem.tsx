/**
 * 문의 한 건 + 답변 목록. '내 문의'와 '문의 관리'가 같은 생김새를 쓴다.
 * docs/feedback.md §5
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
  /** 스토리지 경로 → 서명 URL. 버킷이 비공개라 원본 경로로는 못 띄운다(docs/feedback.md §3) */
  imageUrls?: Map<string, string>
  /** 어드민 화면에서만 작성자를 보여준다 */
  showAuthor?: boolean
  children?: ReactNode
}

export default function FeedbackItem({ feedback: f, replies, imageUrls, showAuthor, children }: Props) {
  const shots = f.images.map((p) => imageUrls?.get(p)).filter((u): u is string => Boolean(u))
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

      {shots.length > 0 && (
        <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {shots.map((url) => (
            // 새 탭으로 원본 보기 — 서명 URL이라 1시간 뒤엔 만료된다
            <Box key={url} component="a" href={url} target="_blank" rel="noopener" sx={{ display: 'block' }}>
              <Box
                component="img"
                src={url}
                alt="첨부 이미지"
                loading="lazy"
                sx={{
                  width: 96,
                  height: 96,
                  objectFit: 'cover',
                  borderRadius: 1,
                  border: 1,
                  borderColor: 'divider',
                  display: 'block',
                }}
              />
            </Box>
          ))}
        </Box>
      )}

      {replies.map((r) => {
        // 쓸 수 있는 사람이 작성자와 어드민뿐이라 별도 플래그 없이 갈린다
        const fromAuthor = r.authorId === f.userId
        return (
          <Box
            key={r.id}
            sx={{
              mt: 1,
              pl: 1.5,
              pr: 1,
              py: 0.75,
              borderLeft: 3,
              borderColor: fromAuthor ? 'divider' : 'primary.main',
              bgcolor: 'action.hover',
            }}
          >
            <Typography
              variant="caption"
              color={fromAuthor ? 'text.secondary' : 'primary'}
              sx={{ fontWeight: 700 }}
            >
              {fromAuthor ? `${f.authorName ?? '작성자'} 재문의` : '운영자 답변'} ·{' '}
              {new Date(r.createdAt).toLocaleString('ko-KR')}
            </Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {r.body}
            </Typography>
          </Box>
        )
      })}

      {children}
    </Paper>
  )
}
