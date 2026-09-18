/**
 * Supabase 클라이언트 싱글턴. docs/cloud-sync.md §2·§7
 *
 * 키는 빌드 시점 환경변수로 들어온다. anon key는 번들에 노출되는 공개값이고
 * 유저 간 격리는 전적으로 RLS가 담당한다 — 테이블을 추가할 때 RLS 활성화를 빠뜨리면 안 된다.
 *
 * 키가 없으면 `isCloudEnabled === false`가 되어 로그인 UI가 숨겨지고 앱은 기존 localStorage
 * 전용으로 동작한다. 키 없이도 빌드·실행되어야 한다(기여자 로컬 환경, 프리뷰 배포).
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { sessionStorageAdapter } from './cookieStorage'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

/**
 * 서비스 식별자. *.mapleland.st의 여러 서비스가 Supabase 프로젝트 하나를 공유하므로
 * user_state/user_slots의 행을 이 값으로 가른다. docs/cloud-sync.md §3
 *
 * 보안 경계가 아니다 — anon key가 공용이라 어느 서비스의 코드든 그 유저의 다른 서비스 행을
 * 읽을 수 있다. 전부 같은 소유자의 서비스라 문제되지 않는다.
 */
export const APP_ID = import.meta.env.VITE_APP_ID || 'item-sim'

/** 클라우드 연동 사용 가능 여부. false면 로그인 UI를 숨긴다 */
export const isCloudEnabled = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

let client: SupabaseClient | null = null

/**
 * 클라이언트 획득 (최초 호출 시 생성).
 * `isCloudEnabled`가 false일 때 부르면 던진다 — 호출부가 먼저 확인할 것.
 */
export function supabase(): SupabaseClient {
  if (!isCloudEnabled) {
    throw new Error('Supabase 키가 없습니다 (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)')
  }
  client ??= createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      // 쿠키 저장소가 서브도메인 SSO를 만든다. storageKey는 기본값(`sb-<ref>-auth-token`)을
      // 그대로 둔다 — 프로젝트가 같으면 전 서비스에서 같은 키라 SSO에 지장이 없고,
      // 바꾸면 서비스마다 값이 갈려 오히려 SSO가 깨진다.
      storage: sessionStorageAdapter(),
      persistSession: true,
      autoRefreshToken: true,
      // OAuth 콜백으로 돌아왔을 때 URL의 인가 코드를 세션으로 바꾼다
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  })
  return client
}
