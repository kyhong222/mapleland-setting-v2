/**
 * 디스코드 로그인 세션. docs/cloud-sync.md §1·§6
 *
 * 영속화하지 않는다 — 세션 보관은 Supabase 클라이언트(쿠키/localStorage)가 맡고,
 * 여기는 그걸 비추는 화면용 상태만 든다. `mlsv2:` 키를 늘리지 않는 이유이기도 하다.
 *
 * 키가 없는 환경에서는 status가 'disabled'로 굳고 로그인 UI가 숨겨진다.
 */

import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'
import { isCloudEnabled, supabase } from '../data/cloud/supabase'

export interface CloudUser {
  id: string
  /** 표시용 이름 (디스코드 프로필) */
  name: string
  avatarUrl?: string
}

export type AuthStatus =
  /** Supabase 키 없음 — 클라우드 기능 전체가 꺼진 상태 */
  | 'disabled'
  /** 세션 확인 중 */
  | 'loading'
  | 'signedOut'
  | 'signedIn'

interface AuthState {
  status: AuthStatus
  user: CloudUser | null
  /** 사용자에게 보여줄 오류 (없으면 null) */
  error: string | null
  signIn: () => Promise<void>
  signOut: () => Promise<void>
}

/** 디스코드 메타데이터 → 표시용 유저. 필드명이 계정 종류에 따라 갈려 순서대로 훑는다 */
function toUser(session: Session | null): CloudUser | null {
  if (!session) return null
  const meta = (session.user.user_metadata ?? {}) as Record<string, unknown>
  const pick = (...keys: string[]): string | undefined => {
    for (const k of keys) {
      const v = meta[k]
      if (typeof v === 'string' && v) return v
    }
    return undefined
  }
  return {
    id: session.user.id,
    name: pick('full_name', 'name', 'user_name', 'preferred_username') ?? '디스코드 사용자',
    avatarUrl: pick('avatar_url', 'picture'),
  }
}

export const useAuthStore = create<AuthState>()((set) => ({
  status: isCloudEnabled ? 'loading' : 'disabled',
  user: null,
  error: null,

  signIn: async () => {
    if (!isCloudEnabled) return
    set({ error: null })
    const { error } = await supabase().auth.signInWithOAuth({
      provider: 'discord',
      options: {
        // 로그인 후 지금 보던 서비스로 돌아온다. Supabase의 Redirect URLs에 등록된
        // 출처여야 한다(docs/cloud-sync.md §7-C).
        redirectTo: window.location.origin,
        scopes: 'identify email',
      },
    })
    // 정상 흐름에서는 디스코드로 이동하므로 이 아래가 실행되지 않는다
    if (error) set({ error: '디스코드 로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.' })
  },

  signOut: async () => {
    if (!isCloudEnabled) return
    const { error } = await supabase().auth.signOut()
    if (error) {
      set({ error: '로그아웃에 실패했습니다.' })
      return
    }
    set({ status: 'signedOut', user: null, error: null })
  },
}))

let initialized = false

/**
 * 세션 구독 시작. 앱 부팅 시 한 번만 부른다(main.tsx).
 * onAuthStateChange는 구독 직후 현재 세션(INITIAL_SESSION)도 흘려주므로 최초 상태도 여기서 정해진다.
 */
export function initAuth(): void {
  if (initialized || !isCloudEnabled) return
  initialized = true
  // 콜백 안에서 supabase를 다시 await 하면 교착이 생길 수 있어 상태 반영만 한다
  supabase().auth.onAuthStateChange((_event, session) => {
    useAuthStore.setState({
      status: session ? 'signedIn' : 'signedOut',
      user: toUser(session),
      error: null,
    })
  })
}
