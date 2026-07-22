/**
 * 문의하기 서버리스 프록시 (Vercel Node Function).
 *
 * 앱의 FeedbackDialog가 { type, title, body, contact, hp } 를 POST하면
 * 서버에 숨긴 토큰으로 GitHub 이슈를 생성한다. 사용자는 GitHub 계정이 없어도 된다.
 *
 * 필요한 환경변수 (Vercel Project Settings → Environment Variables):
 *   GITHUB_TOKEN   (필수) 이슈 쓰기 권한 토큰. Fine-grained PAT 권장:
 *                  해당 레포에만 Repository access, 권한 Issues: Read and write.
 *   GITHUB_OWNER   (선택) 기본 'kyhong222'
 *   GITHUB_REPO    (선택) 기본 'mapleland-setting-v2'
 *   ALLOWED_ORIGIN (선택) CORS 허용 출처. 미설정 시 '*'.
 *                  GitHub Pages에서 호출한다면 'https://<user>.github.io' 로 제한 권장.
 *
 * Cloudflare Worker 등 다른 런타임으로 옮길 경우 아래 handler 로직만 이식하면 된다.
 */

const OWNER = process.env.GITHUB_OWNER || 'kyhong222'
const REPO = process.env.GITHUB_REPO || 'mapleland-setting-v2'
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*'

const TYPE_LABEL = { bug: '버그', idea: '건의', etc: '기타' }
const TITLE_MAX = 120
const BODY_MAX = 5000
const CONTACT_MAX = 120

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN)
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Max-Age', '86400')
}

function clean(v, max) {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}

export default async function handler(req, res) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })

  const body = typeof req.body === 'string' ? safeParse(req.body) : req.body || {}
  const { type = 'etc', hp } = body
  const title = clean(body.title, TITLE_MAX)
  const content = clean(body.body, BODY_MAX)
  const contact = clean(body.contact, CONTACT_MAX)

  // 허니팟: 사람은 비워두는 숨김 필드. 값이 있으면 봇 → 조용히 성공 처리(생성 안 함)
  if (typeof hp === 'string' && hp.length > 0) return res.status(200).json({ ok: true, url: '' })

  if (!title || !content) return res.status(400).json({ error: '제목과 내용을 입력해 주세요.' })

  if (!process.env.GITHUB_TOKEN) {
    return res.status(500).json({ error: '서버에 GITHUB_TOKEN이 설정되지 않았습니다.' })
  }

  const tag = TYPE_LABEL[type] || TYPE_LABEL.etc
  const issueTitle = `[${tag}] ${title}`
  const lines = [content]
  if (contact) lines.push('', '---', `연락처: ${contact}`)
  lines.push('', `<sub>앱 문의 폼에서 접수됨 · type=${type}</sub>`)

  try {
    const gh = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        'User-Agent': `${OWNER}-feedback-proxy`,
      },
      body: JSON.stringify({ title: issueTitle, body: lines.join('\n'), labels: ['user-feedback', tag] }),
    })

    if (!gh.ok) {
      const detail = await gh.text().catch(() => '')
      console.error('GitHub API error', gh.status, detail)
      return res.status(502).json({ error: `GitHub 등록 실패 (${gh.status})` })
    }

    const issue = await gh.json()
    return res.status(200).json({ ok: true, url: issue.html_url, number: issue.number })
  } catch (e) {
    console.error('feedback proxy error', e)
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' })
  }
}

function safeParse(s) {
  try { return JSON.parse(s) } catch { return {} }
}
