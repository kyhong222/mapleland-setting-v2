interface ImportMetaEnv {
  /** 문의하기 서버리스 프록시 엔드포인트 (미설정 시 /api/feedback) */
  readonly VITE_FEEDBACK_ENDPOINT?: string
  /** Supabase 프로젝트 URL. 없으면 클라우드 연동 전체가 꺼진다. docs/cloud-sync.md §7 */
  readonly VITE_SUPABASE_URL?: string
  /** Supabase anon public key — 번들에 노출되는 공개값. 격리는 RLS가 담당한다 */
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** 서비스 식별자. *.mapleland.st가 Supabase 프로젝트를 공유하므로 서비스마다 달라야 한다 */
  readonly VITE_APP_ID?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
