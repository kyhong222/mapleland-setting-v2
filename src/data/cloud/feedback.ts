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
  /** 첨부 이미지의 스토리지 경로. 보여주려면 서명 URL로 바꿔야 한다(signImages) */
  images: string[]
  createdAt: string
}

/** 첨부 이미지 버킷. 비공개다 — 읽을 때마다 서명 URL을 만든다(docs/feedback.md §3) */
export const FEEDBACK_BUCKET = 'feedback'
export const MAX_IMAGES = 3
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
/** 서명 URL 수명(초) */
const SIGN_TTL = 3600

export interface FeedbackReply {
  id: string
  feedbackId: string
  /**
   * 쓴 사람. 문의 작성자와 같으면 재문의, 다르면 운영자 답변이다 —
   * 쓸 수 있는 사람이 그 둘뿐이라 별도 플래그 없이 갈린다(docs/feedback.md §2).
   */
  authorId: string
  body: string
  createdAt: string
}

const FEEDBACK_COLUMNS =
  'id, user_id, app_id, type, title, body, status, is_public, author_name, author_avatar, images, created_at'

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
  images: string[] | null
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
  images: r.images ?? [],
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

/**
 * 첨부 이미지 업로드. 경로는 `<user_id>/<feedback_id>/<uuid>.<ext>` —
 * 스토리지 정책이 폴더 이름만으로 소유자/문의를 판정한다(docs/feedback.md §3).
 *
 * 문의 행보다 먼저 올리므로 행 삽입이 실패하면 고아 파일이 남는다.
 * 비공개 버킷이라 누구에게도 보이지 않아 그대로 둔다.
 */
export async function uploadFeedbackImages(
  userId: string,
  feedbackId: string,
  files: File[],
): Promise<string[]> {
  const storage = supabase().storage.from(FEEDBACK_BUCKET)
  const paths: string[] = []
  for (const file of files.slice(0, MAX_IMAGES)) {
    const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '')
    const path = `${userId}/${feedbackId}/${crypto.randomUUID()}.${ext}`
    const { error } = await storage.upload(path, file, { contentType: file.type, upsert: false })
    if (error) throw new Error(`이미지 업로드 실패: ${error.message}`)
    paths.push(path)
  }
  return paths
}

/** 경로 → 서명 URL. 정책이 막은 경로는 결과에서 빠진다 */
export async function signImages(paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const unique = [...new Set(paths)]
  if (unique.length === 0) return out
  const { data, error } = await supabase().storage.from(FEEDBACK_BUCKET).createSignedUrls(unique, SIGN_TTL)
  if (error) return out // 이미지가 안 보일 뿐 목록은 그대로 보여준다
  for (const row of data ?? []) {
    if (row.signedUrl && row.path) out.set(row.path, row.signedUrl)
  }
  return out
}

export interface NewFeedback {
  /** 이미지 경로를 먼저 정해야 해서 id를 호출부가 만든다 */
  id: string
  type: FeedbackType
  title: string
  body: string
  authorName: string | null
  authorAvatar: string | null
  images: string[]
}

export async function createFeedback(userId: string, input: NewFeedback): Promise<Feedback> {
  const { data, error } = await supabase()
    .from('feedbacks')
    .insert({
      id: input.id,
      user_id: userId,
      app_id: APP_ID,
      type: input.type,
      title: input.title,
      body: input.body,
      author_name: input.authorName,
      author_avatar: input.authorAvatar,
      images: input.images,
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

const REPLY_COLUMNS = 'id, feedback_id, author_id, body, created_at'

interface ReplyRow {
  id: string
  feedback_id: string
  author_id: string
  body: string
  created_at: string
}

const toReply = (r: ReplyRow): FeedbackReply => ({
  id: r.id,
  feedbackId: r.feedback_id,
  authorId: r.author_id,
  body: r.body,
  createdAt: r.created_at,
})

/** 여러 문의의 답글을 한 번에 — 문의 수만큼 요청을 날리지 않는다 */
export async function listReplies(feedbackIds: string[]): Promise<Map<string, FeedbackReply[]>> {
  const out = new Map<string, FeedbackReply[]>()
  if (feedbackIds.length === 0) return out
  const { data, error } = await supabase()
    .from('feedback_replies')
    .select(REPLY_COLUMNS)
    .in('feedback_id', feedbackIds)
    .order('created_at')
  if (error) throw new Error(error.message)
  for (const r of data ?? []) {
    const reply = toReply(r as ReplyRow)
    const list = out.get(reply.feedbackId) ?? []
    list.push(reply)
    out.set(reply.feedbackId, list)
  }
  return out
}

/**
 * 답글 작성 — 어드민의 답변이거나 작성자의 재문의다.
 * 트리거가 상태를 옮긴다(어드민이면 answered, 작성자면 open으로 되돌림).
 */
export async function createReply(feedbackId: string, authorId: string, body: string): Promise<FeedbackReply> {
  const { data, error } = await supabase()
    .from('feedback_replies')
    .insert({ feedback_id: feedbackId, author_id: authorId, body })
    .select(REPLY_COLUMNS)
    .single()
  if (error) throw new Error(error.message)
  return toReply(data as ReplyRow)
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
