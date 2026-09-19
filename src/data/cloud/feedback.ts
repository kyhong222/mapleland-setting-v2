/**
 * 문의/답변 데이터 접근. docs/feedback.md §2
 *
 * 앱 도메인 타입을 쓰지 않는다 — 어드민 화면을 나중에 별도 서비스로 옮길 때 이 파일만
 * 들고 나가면 되게 하기 위함이다(cloud/ 폴더의 다른 파일과 같은 규칙).
 *
 * 권한은 전부 RLS가 건다. 여기서 하는 검사는 화면을 감추기 위한 것일 뿐이고,
 * 실제 차단은 서버에서 일어난다.
 */

import { APP_ID, supabase } from './supabase'

export type FeedbackType = 'bug' | 'idea' | 'etc'
export type FeedbackStatus = 'open' | 'answered' | 'resolved' | 'wontfix'

export interface Feedback {
  id: string
  userId: string
  appId: string
  type: FeedbackType
  title: string
  body: string
  status: FeedbackStatus
  /** 대문 노출 여부. 어드민만 켤 수 있다 */
  isPublic: boolean
  authorName: string | null
  authorAvatar: string | null
  createdAt: string
}

export interface FeedbackReply {
  id: string
  feedbackId: string
  body: string
  createdAt: string
}

const FEEDBACK_COLUMNS =
  'id, user_id, app_id, type, title, body, status, is_public, author_name, author_avatar, created_at'

interface FeedbackRow {
  id: string
  user_id: string
  app_id: string
  type: FeedbackType
  title: string
  body: string
  status: FeedbackStatus
  is_public: boolean
  author_name: string | null
  author_avatar: string | null
  created_at: string
}

const toFeedback = (r: FeedbackRow): Feedback => ({
  id: r.id,
  userId: r.user_id,
  appId: r.app_id,
  type: r.type,
  title: r.title,
  body: r.body,
  status: r.status,
  isPublic: r.is_public,
  authorName: r.author_name,
  authorAvatar: r.author_avatar,
  createdAt: r.created_at,
})

/**
 * 어드민인지. **화면 표시용 힌트다** — admins에서 자기 행을 읽을 수 있는지로 판단한다.
 * 이걸 우회해도 쓰기는 RLS가 막는다.
 */
export async function checkIsAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase()
    .from('admins')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) return false
  return data !== null
}

export interface NewFeedback {
  type: FeedbackType
  title: string
  body: string
  authorName: string | null
  authorAvatar: string | null
}

export async function createFeedback(userId: string, input: NewFeedback): Promise<Feedback> {
  const { data, error } = await supabase()
    .from('feedbacks')
    .insert({
      user_id: userId,
      app_id: APP_ID,
      type: input.type,
      title: input.title,
      body: input.body,
      author_name: input.authorName,
      author_avatar: input.authorAvatar,
    })
    .select(FEEDBACK_COLUMNS)
    .single()
  if (error) throw new Error(error.message)
  return toFeedback(data as FeedbackRow)
}

/** 내 문의 (앱을 가리지 않는다 — 다른 서비스에서 남긴 것도 한 번에 본다) */
export async function listMyFeedbacks(userId: string): Promise<Feedback[]> {
  const { data, error } = await supabase()
    .from('feedbacks')
    .select(FEEDBACK_COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => toFeedback(r as FeedbackRow))
}

/**
 * 어드민 목록 — 전부 가져온다.
 * 어드민이 아닌 사람이 불러도 RLS가 '공개된 것 + 본인 것'까지만 내주므로 남의 비공개 문의는 새지 않는다.
 */
export async function listAllFeedbacks(status?: FeedbackStatus): Promise<Feedback[]> {
  let q = supabase().from('feedbacks').select(FEEDBACK_COLUMNS).order('created_at', { ascending: false })
  if (status) q = q.eq('status', status)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => toFeedback(r as FeedbackRow))
}

/** 여러 문의의 답변을 한 번에 — 문의 수만큼 요청을 날리지 않는다 */
export async function listReplies(feedbackIds: string[]): Promise<Map<string, FeedbackReply[]>> {
  const out = new Map<string, FeedbackReply[]>()
  if (feedbackIds.length === 0) return out
  const { data, error } = await supabase()
    .from('feedback_replies')
    .select('id, feedback_id, body, created_at')
    .in('feedback_id', feedbackIds)
    .order('created_at')
  if (error) throw new Error(error.message)
  for (const r of data ?? []) {
    const row = r as { id: string; feedback_id: string; body: string; created_at: string }
    const list = out.get(row.feedback_id) ?? []
    list.push({ id: row.id, feedbackId: row.feedback_id, body: row.body, createdAt: row.created_at })
    out.set(row.feedback_id, list)
  }
  return out
}

/** 답변 작성 (어드민). 트리거가 문의 상태를 answered로 올린다 */
export async function createReply(feedbackId: string, authorId: string, body: string): Promise<FeedbackReply> {
  const { data, error } = await supabase()
    .from('feedback_replies')
    .insert({ feedback_id: feedbackId, author_id: authorId, body })
    .select('id, feedback_id, body, created_at')
    .single()
  if (error) throw new Error(error.message)
  const row = data as { id: string; feedback_id: string; body: string; created_at: string }
  return { id: row.id, feedbackId: row.feedback_id, body: row.body, createdAt: row.created_at }
}

/** 상태·공개 여부 변경 (어드민) */
export async function updateFeedback(
  id: string,
  patch: { status?: FeedbackStatus; isPublic?: boolean },
): Promise<void> {
  const body: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.status !== undefined) body.status = patch.status
  if (patch.isPublic !== undefined) body.is_public = patch.isPublic
  const { error } = await supabase().from('feedbacks').update(body).eq('id', id)
  if (error) throw new Error(error.message)
}
