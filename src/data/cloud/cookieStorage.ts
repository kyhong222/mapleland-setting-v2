/**
 * Supabase 세션 저장소 — *.mapleland.st 서브도메인 간 SSO용. docs/cloud-sync.md §2
 *
 * Supabase 기본값인 localStorage는 origin별이라 item. 과 skill. 이 세션을 공유하지 못하고
 * 서비스마다 로그인 버튼을 다시 눌러야 한다. 루트 도메인(`.mapleland.st`)에 쿠키를 심으면
 * 전 서비스가 같은 세션을 본다.
 *
 * 세션 JSON은 쿠키 1개 상한(4096B)을 넘길 수 있어 조각으로 나눠 담는다(`<key>.0`, `<key>.1`, ...).
 * mapleland.st 계열이 아닌 호스트(로컬 개발·프리뷰 배포)에서는 루트 도메인 쿠키를 심을 수 없어
 * localStorage로 떨어진다 — 그 경우 SSO는 없지만 단일 서비스 로그인은 정상 동작한다.
 *
 * 트레이드오프: 세션 쿠키가 같은 도메인의 모든 요청에 실려 요청당 수 KB가 늘어난다.
 * 정적 SPA라 요청 수가 적어 감수한다.
 */

/** 세션 쿠키를 심을 루트 도메인 */
const ROOT_DOMAIN = 'mapleland.st'

/**
 * 조각 1개의 원본 길이.
 * 쿠키 상한은 4096바이트인데 `encodeURIComponent`가 JSON의 `{` `"` `,` 등을 3바이트로 부풀린다.
 * 최악(전부 3배)에도 상한 안에 들도록 보수적으로 잡았다.
 */
const CHUNK_SIZE = 1200

/** 조각을 훑을 상한 — 세션이 이 크기를 넘길 일은 없다 */
const MAX_CHUNKS = 16

/** 400일. 브라우저가 허용하는 쿠키 수명 상한 */
const MAX_AGE = 400 * 24 * 60 * 60

/** Supabase가 요구하는 동기 저장소 인터페이스 (localStorage의 부분집합) */
export interface SessionStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/** 이 호스트에서 쓸 쿠키 도메인. mapleland.st 계열이 아니면 null → localStorage 폴백 */
function cookieDomain(): string | null {
  const host = window.location.hostname
  if (host === ROOT_DOMAIN || host.endsWith(`.${ROOT_DOMAIN}`)) return `.${ROOT_DOMAIN}`
  return null
}

function readCookie(name: string): string | null {
  const prefix = `${encodeURIComponent(name)}=`
  for (const part of document.cookie.split('; ')) {
    if (part.startsWith(prefix)) return decodeURIComponent(part.slice(prefix.length))
  }
  return null
}

function writeCookie(name: string, value: string, domain: string): void {
  document.cookie =
    `${encodeURIComponent(name)}=${encodeURIComponent(value)}` +
    `; Domain=${domain}; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax; Secure`
}

function dropCookie(name: string, domain: string): void {
  // Max-Age=0 으로 즉시 만료. 심을 때와 Domain/Path가 같아야 지워진다.
  document.cookie = `${encodeURIComponent(name)}=; Domain=${domain}; Path=/; Max-Age=0; SameSite=Lax; Secure`
}

function chunkedCookieStorage(domain: string): SessionStorage {
  return {
    getItem(key) {
      const chunks: string[] = []
      for (let i = 0; i < MAX_CHUNKS; i++) {
        const c = readCookie(`${key}.${i}`)
        if (c === null) break
        chunks.push(c)
      }
      // 조각이 없으면 쪼개지 않고 심겼던 값(옛 형식/타 라이브러리)도 한 번 본다
      return chunks.length > 0 ? chunks.join('') : readCookie(key)
    },

    setItem(key, value) {
      dropCookie(key, domain) // 쪼개지 않은 옛 값이 남아 getItem을 헷갈리게 하지 않도록
      const count = Math.max(1, Math.ceil(value.length / CHUNK_SIZE))
      for (let i = 0; i < count; i++) {
        writeCookie(`${key}.${i}`, value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE), domain)
      }
      // 값이 짧아지면 뒤쪽 옛 조각이 남아 이어붙을 때 쓰레기가 섞인다 — 끊길 때까지 지운다
      for (let i = count; i < MAX_CHUNKS; i++) {
        if (readCookie(`${key}.${i}`) === null) break
        dropCookie(`${key}.${i}`, domain)
      }
    },

    removeItem(key) {
      dropCookie(key, domain)
      for (let i = 0; i < MAX_CHUNKS; i++) dropCookie(`${key}.${i}`, domain)
    },
  }
}

/** localStorage가 막힌 환경(사파리 프라이빗 등)에서도 죽지 않도록 감싼다 */
function safeLocalStorage(): SessionStorage {
  return {
    getItem: (k) => {
      try {
        return window.localStorage.getItem(k)
      } catch {
        return null
      }
    },
    setItem: (k, v) => {
      try {
        window.localStorage.setItem(k, v)
      } catch {
        /* 저장 실패 시 세션은 탭 수명 동안만 유지된다 */
      }
    },
    removeItem: (k) => {
      try {
        window.localStorage.removeItem(k)
      } catch {
        /* noop */
      }
    },
  }
}

/** 이 호스트에 맞는 세션 저장소. mapleland.st면 쿠키(SSO), 아니면 localStorage */
export function sessionStorageAdapter(): SessionStorage {
  const domain = cookieDomain()
  return domain ? chunkedCookieStorage(domain) : safeLocalStorage()
}

/** 서브도메인 간 SSO가 실제로 켜졌는지 (UI 안내용) */
export function isSsoHost(): boolean {
  return cookieDomain() !== null
}
