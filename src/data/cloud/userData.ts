/**
 * user_state / user_slots 행 접근. docs/cloud-sync.md §3·§4
 *
 * 이 파일은 앱 도메인 타입을 모른다 — payload/snapshot은 `unknown`으로만 다룬다.
 * 다음 서비스(스킬 시뮬 등)가 이 폴더를 그대로 가져다 쓸 수 있게 하기 위함이다.
 *
 * 쓰기는 전부 `rev` 낙관적 잠금이다. 마지막으로 읽은 rev를 조건에 걸고, 0행이 갱신되면
 * 다른 기기가 먼저 쓴 것이므로 'conflict'를 돌려준다. 조용한 last-write-wins로 덮지 않는다.
 * rev 증가는 DB 트리거(bump_rev)가 하므로 갱신 후 돌아온 값을 그대로 다음 기준으로 쓴다.
 */

import { supabase } from './supabase'

export interface StateRow {
  schemaVersion: number
  payload: unknown
  rev: number
}

/** 저장슬롯 1칸. idx는 0부터 (SLOT_COUNT-1)까지 */
export interface SlotRow {
  idx: number
  name: string | null
  savedAt: string
  schemaVersion: number
  snapshot: unknown
  rev: number
}

export type WriteResult =
  | { ok: true; rev: number }
  /** 다른 기기가 먼저 썼다 — 호출부가 사용자에게 물어야 한다 */
  | { ok: false; reason: 'conflict' }
  | { ok: false; reason: 'error'; message: string }

/** Postgres unique_violation — insert 하려는데 이미 행이 있다(= 다른 기기가 먼저 만듦) */
const UNIQUE_VIOLATION = '23505'

export async function fetchState(userId: string, appId: string): Promise<StateRow | null> {
  const { data, error } = await supabase()
    .from('user_state')
    .select('schema_version, payload, rev')
    .eq('user_id', userId)
    .eq('app_id', appId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return { schemaVersion: data.schema_version, payload: data.payload, rev: data.rev }
}

export async function fetchSlots(userId: string, appId: string): Promise<SlotRow[]> {
  const { data, error } = await supabase()
    .from('user_slots')
    .select('idx, name, saved_at, schema_version, snapshot, rev')
    .eq('user_id', userId)
    .eq('app_id', appId)
    .order('idx')
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => ({
    idx: r.idx,
    name: r.name,
    savedAt: r.saved_at,
    schemaVersion: r.schema_version,
    snapshot: r.snapshot,
    rev: r.rev,
  }))
}

export async function pushState(
  userId: string,
  appId: string,
  payload: unknown,
  schemaVersion: number,
  /** 마지막으로 읽은 rev. null이면 "서버에 아직 없다"는 뜻이라 insert한다 */
  knownRev: number | null,
): Promise<WriteResult> {
  const sb = supabase()
  if (knownRev === null) {
    const { data, error } = await sb
      .from('user_state')
      .insert({ user_id: userId, app_id: appId, schema_version: schemaVersion, payload })
      .select('rev')
      .maybeSingle()
    if (error) {
      return error.code === UNIQUE_VIOLATION
        ? { ok: false, reason: 'conflict' }
        : { ok: false, reason: 'error', message: error.message }
    }
    return { ok: true, rev: data?.rev ?? 1 }
  }

  const { data, error } = await sb
    .from('user_state')
    .update({ schema_version: schemaVersion, payload })
    .eq('user_id', userId)
    .eq('app_id', appId)
    .eq('rev', knownRev)
    .select('rev')
    .maybeSingle()
  if (error) return { ok: false, reason: 'error', message: error.message }
  // 0행 = rev가 어긋났다. 행이 사라졌을 수도 있는데 어느 쪽이든 사용자 판단이 필요하다
  if (!data) return { ok: false, reason: 'conflict' }
  return { ok: true, rev: data.rev }
}

export async function pushSlot(
  userId: string,
  appId: string,
  slot: { idx: number; name: string | null; savedAt: string; snapshot: unknown },
  schemaVersion: number,
  knownRev: number | null,
): Promise<WriteResult> {
  const sb = supabase()
  const body = {
    name: slot.name,
    saved_at: slot.savedAt,
    schema_version: schemaVersion,
    snapshot: slot.snapshot,
  }

  if (knownRev === null) {
    const { data, error } = await sb
      .from('user_slots')
      .insert({ user_id: userId, app_id: appId, idx: slot.idx, ...body })
      .select('rev')
      .maybeSingle()
    if (error) {
      return error.code === UNIQUE_VIOLATION
        ? { ok: false, reason: 'conflict' }
        : { ok: false, reason: 'error', message: error.message }
    }
    return { ok: true, rev: data?.rev ?? 1 }
  }

  const { data, error } = await sb
    .from('user_slots')
    .update(body)
    .eq('user_id', userId)
    .eq('app_id', appId)
    .eq('idx', slot.idx)
    .eq('rev', knownRev)
    .select('rev')
    .maybeSingle()
  if (error) return { ok: false, reason: 'error', message: error.message }
  if (!data) return { ok: false, reason: 'conflict' }
  return { ok: true, rev: data.rev }
}

/** 슬롯 비우기. 이미 없어도 성공으로 친다(지우려는 의도가 이미 달성된 상태) */
export async function deleteSlot(userId: string, appId: string, idx: number): Promise<void> {
  const { error } = await supabase()
    .from('user_slots')
    .delete()
    .eq('user_id', userId)
    .eq('app_id', appId)
    .eq('idx', idx)
  if (error) throw new Error(error.message)
}

/** 계정 데이터 전체 삭제 (이관 시 "이 기기 것으로 덮기"에서 슬롯을 싹 비울 때 쓴다) */
export async function deleteAllSlots(userId: string, appId: string): Promise<void> {
  const { error } = await supabase()
    .from('user_slots')
    .delete()
    .eq('user_id', userId)
    .eq('app_id', appId)
  if (error) throw new Error(error.message)
}
