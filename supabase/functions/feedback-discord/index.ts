/**
 * 문의 ↔ 디스코드 봇. docs/feedback.md §6
 *
 * 한 함수가 두 요청을 받는다.
 *  1) DB 트리거(pg_net) — 새 문의를 운영자 DM으로 보낸다. `x-notify-secret` 헤더로 인증
 *  2) 디스코드 Interactions — DM의 [답변하기] 버튼 → 모달 → 제출하면 feedback_replies에 넣는다.
 *     디스코드 서명(Ed25519)으로 인증
 *
 * 평문 답장(DM에 그냥 타이핑)은 받을 수 없다 — 메시지 수신은 상시 Gateway 연결이 필요한데
 * Edge Function은 요청이 올 때만 뜬다. 버튼·모달은 HTTP로 오므로 서버 없이 된다.
 *
 * 배포: supabase functions deploy feedback-discord --no-verify-jwt --use-api
 * (디스코드도 트리거도 Supabase JWT를 보내지 않는다. 인증은 위 두 방식이 대신한다)
 */

import { createClient } from 'npm:@supabase/supabase-js@2'
import nacl from 'npm:tweetnacl@1.0.3'

const env = (k: string) => {
  const v = Deno.env.get(k)
  if (!v) throw new Error(`환경변수 ${k}가 없습니다`)
  return v
}

const BOT_TOKEN = env('DISCORD_BOT_TOKEN')
const PUBLIC_KEY = env('DISCORD_PUBLIC_KEY')
/** 알림을 받고 답변할 수 있는 운영자의 디스코드 사용자 ID */
const ADMIN_DISCORD_ID = env('DISCORD_ADMIN_ID')
/** 그 운영자의 auth.users id. 답변 행의 author_id가 된다 */
const ADMIN_USER_ID = env('ADMIN_USER_ID')
const NOTIFY_SECRET = env('FEEDBACK_NOTIFY_SECRET')

// service role — 답변 삽입이 RLS(is_admin)를 거치지 않는다. 운영자 확인은 아래에서 직접 한다
const supabase = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'))

const API = 'https://discord.com/api/v10'

const TYPE_LABEL: Record<string, string> = {
  bug: '🐛 버그 제보',
  idea: '💡 기능 건의',
  etc: '💬 기타',
}
const TYPE_COLOR: Record<string, number> = { bug: 0xed4245, idea: 0xfee75c, etc: 0x5865f2 }

/** 디스코드 모달 입력 한도 */
const REPLY_MAX = 4000

interface FeedbackRow {
  id: string
  app_id: string
  type: string
  title: string
  body: string
  author_name: string | null
  images: string[] | null
  created_at: string
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

async function discord(path: string, body: unknown) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bot ${BOT_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`discord ${path} ${res.status}: ${await res.text()}`)
  return res.json()
}

// ── 1) 새 문의 → 운영자 DM ───────────────────────────────────────

async function notify(row: FeedbackRow) {
  // DM 채널은 같은 상대면 매번 같은 id가 돌아온다. 봇과 운영자가 서버 하나를 공유해야 열린다
  const dm = await discord('/users/@me/channels', { recipient_id: ADMIN_DISCORD_ID })
  const body = row.body.length > 1000 ? `${row.body.slice(0, 1000)} …` : row.body

  await discord(`/channels/${dm.id}/messages`, {
    content: '📮 새 문의',
    // 사용자 본문에 멘션이 있어도 아무도 호출하지 않는다
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title: row.title.slice(0, 256),
        description: body || undefined,
        color: TYPE_COLOR[row.type] ?? TYPE_COLOR.etc,
        fields: [
          { name: '유형', value: TYPE_LABEL[row.type] ?? row.type, inline: true },
          { name: '서비스', value: row.app_id, inline: true },
          { name: '작성자', value: row.author_name || '(이름 없음)', inline: true },
          { name: '첨부', value: `${row.images?.length ?? 0}장`, inline: true },
        ],
        footer: { text: row.id },
        timestamp: row.created_at,
      },
    ],
    components: [
      {
        type: 1,
        components: [{ type: 2, style: 1, label: '답변하기', custom_id: `reply:${row.id}` }],
      },
    ],
  })
}

// ── 2) 디스코드 Interactions ──────────────────────────────────────

const hexToBytes = (hex: string) => new Uint8Array(hex.match(/../g)!.map((h) => parseInt(h, 16)))

function verified(req: Request, raw: string) {
  const sig = req.headers.get('x-signature-ed25519')
  const ts = req.headers.get('x-signature-timestamp')
  if (!sig || !ts) return false
  return nacl.sign.detached.verify(
    new TextEncoder().encode(ts + raw),
    hexToBytes(sig),
    hexToBytes(PUBLIC_KEY),
  )
}

/** 본인에게만 보이는 응답 */
const ephemeral = (content: string) => json({ type: 4, data: { content, flags: 64 } })

async function interact(i: any) {
  // PING — 디스코드가 엔드포인트를 등록할 때 확인한다
  if (i.type === 1) return json({ type: 1 })

  // DM에서는 user, 서버 채널에서는 member.user로 온다
  const who = i.user?.id ?? i.member?.user?.id
  if (who !== ADMIN_DISCORD_ID) return ephemeral('운영자만 답변할 수 있습니다.')

  // [답변하기] 버튼 → 모달
  if (i.type === 3 && i.data.custom_id.startsWith('reply:')) {
    const id = i.data.custom_id.slice('reply:'.length)
    return json({
      type: 9,
      data: {
        custom_id: `reply_modal:${id}`,
        title: '답변 작성',
        components: [
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: 'body',
                label: '답변 (앱의 내 문의에 그대로 보입니다)',
                style: 2,
                required: true,
                max_length: REPLY_MAX,
              },
            ],
          },
        ],
      },
    })
  }

  // 모달 제출 → 답변 등록. 상태는 mark_answered 트리거가 answered로 바꾼다(§2)
  if (i.type === 5 && i.data.custom_id.startsWith('reply_modal:')) {
    const id = i.data.custom_id.slice('reply_modal:'.length)
    const body: string = i.data.components[0].components[0].value.trim()
    if (!body) return ephemeral('답변이 비어 있습니다.')

    const { error } = await supabase
      .from('feedback_replies')
      .insert({ feedback_id: id, author_id: ADMIN_USER_ID, body })
    if (error) return ephemeral(`답변 등록 실패: ${error.message}`)

    const quoted = body.length > 1500 ? `${body.slice(0, 1500)} …` : body
    return json({
      type: 4,
      data: {
        content: `✅ 답변을 등록했습니다 (\`${id}\`)\n>>> ${quoted}`,
        allowed_mentions: { parse: [] },
      },
    })
  }

  return ephemeral('알 수 없는 요청입니다.')
}

// ── 진입점 ──────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 })
  const raw = await req.text()

  if (req.headers.has('x-notify-secret')) {
    if (req.headers.get('x-notify-secret') !== NOTIFY_SECRET) return new Response('forbidden', { status: 403 })
    try {
      await notify(JSON.parse(raw).record)
      return json({ ok: true })
    } catch (e) {
      console.error(e)
      return json({ ok: false, error: String(e) }, 502)
    }
  }

  if (!verified(req, raw)) return new Response('invalid request signature', { status: 401 })
  return interact(JSON.parse(raw))
})
