interface ImportMetaEnv {
  /** 문의하기 서버리스 프록시 엔드포인트 (미설정 시 /api/feedback) */
  readonly VITE_FEEDBACK_ENDPOINT?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
