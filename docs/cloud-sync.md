# 클라우드 연동 (디스코드 로그인 + 계정 동기화)

로컬 전용이던 세팅 데이터를 디스코드 계정에 묶어 여러 기기·여러 서비스에서 함께 쓰기 위한 확정본.
결정 근거와 콘솔 세팅 절차를 함께 남긴다. 코드는 이 문서를 §번호로 참조한다.

---

## §1 목표와 범위

- 모바일·다른 PC에서 같은 세팅을 이어서 본다.
- **비로그인은 지금 그대로 동작한다.** 로그인은 선택이고, 기존 사용자의 localStorage는 손대지 않는다.
- 로그인 시 이 기기의 로컬 데이터를 계정으로 **이관**하는 경로를 제공한다(§5).
- 같은 디스코드 계정이 `*.mapleland.st`의 다른 서비스(스킬 세팅 시뮬레이터 등)에서 **동일 유저**로 인식된다.

범위 밖: 실시간 협업, 세팅 공유/퍼블릭 링크, 서버측 계산.

---

## §2 구성

| 항목 | 선택 | 근거 |
|---|---|---|
| 인증 + DB | **Supabase 1개 프로젝트** | 디스코드가 내장 provider라 OAuth 서버 코드가 0. RLS로 브라우저 직결이 안전해 SPA 구조를 그대로 둔다 |
| 프로젝트 수 | **전 서비스 공용 1개** | 프로젝트가 나뉘면 `auth.users`도 나뉘어 같은 디스코드 계정이 다른 유저가 된다. 무료 플랜의 활성 프로젝트 2개 제한·50,000 MAU도 프로젝트 단위 |
| 디스코드 앱 | **1개** | Supabase를 쓰면 Redirect URI가 `https://<ref>.supabase.co/auth/v1/callback` 하나뿐이라 서비스가 늘어도 그대로다 |
| 세션 저장소 | **쿠키(`domain=.mapleland.st`)** | 전 서비스가 `*.mapleland.st` 서브도메인이라 쿠키 하나로 진짜 SSO가 된다. localStorage는 origin별이라 서비스마다 다시 로그인해야 한다 |

**비용 0원.** 무료 한도는 DB 500MB · 50,000 MAU · 파일 1GB. 유저당 페이로드를 200KB로 잡으면 약 2,500명.
현재 크기는 브라우저 콘솔에서 잴 수 있다:

```js
Object.keys(localStorage).filter(k => k.startsWith('mlsv2:'))
  .map(k => [k, (new Blob([localStorage[k]]).size / 1024).toFixed(1) + 'KB'])
```

주의: **무료 프로젝트는 1주간 DB 활동이 없으면 일시정지된다**(2026-02-01 정책 강화). 실사용 중이면 무관하지만
런칭 전 테스트 기간에는 Vercel Cron으로 하루 1회 핑을 걸어두면 안전하다.

---

## §3 스키마

### 설계 결정

- **`app_id`로 서비스를 가른다.** 서비스마다 `schema_version`이 독립이어야 한 서비스의 버전 인상이
  다른 서비스 데이터를 건드리지 않는다.
- **`app_id`는 네임스페이스지 보안 경계가 아니다.** anon key가 전 서비스 공용이므로 어느 앱의 브라우저
  코드든 그 유저의 다른 앱 행을 읽을 수 있다. 전부 같은 소유자의 서비스라 문제되지 않지만, 외부 서비스를
  붙일 때는 `app_id`를 JWT 클레임에 넣고 정책을 거는 별도 작업이 필요하다.
- **`user_state`와 `user_slots`를 쪼갠다.** 개인 인벤토리가 슬롯마다 복제되는 구조라 한 행에 몰면 MB 단위가
  되고, 슬롯 1칸 저장에도 전체를 올려야 한다.
- **`characters`는 만들되 당장 쓰지 않는다.** 계정만 공유하면 "같은 아이디로 로그인된다"에 그치고,
  아이템 세팅과 스킬 세팅이 같은 캐릭터로 묶일 때 연동의 값이 나온다. 지금 `user_slots.character_id`를
  비워두는 비용은 0이지만, 나중에 붙이려면 두 서비스의 저장 데이터를 동시에 마이그레이션해야 한다.
  슬롯 24칸(캐릭터 6 × 계정 4)에 이름·직업·레벨이 이미 있어 여기서 캐릭터 행을 파생시킬 수 있다.

### DDL

Supabase Dashboard → SQL Editor에 그대로 붙여 넣는다.

```sql
-- ── 전 서비스 공용 프로필 ──────────────────────────────────────
create table public.profiles (
  user_id      uuid primary key references auth.users on delete cascade,
  discord_id   text,
  display_name text,
  avatar_url   text,
  updated_at   timestamptz not null default now()
);

-- 가입 시 디스코드 메타데이터로 프로필 자동 생성
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $fn$
begin
  insert into public.profiles (user_id, discord_id, display_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data ->> 'provider_id',
    coalesce(new.raw_user_meta_data ->> 'full_name',
             new.raw_user_meta_data ->> 'name',
             new.raw_user_meta_data ->> 'user_name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (user_id) do nothing;
  return new;
end;
$fn$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── 캐릭터 (§3 참고: 지금은 만들어만 둔다) ─────────────────────
create table public.characters (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  name       text not null,
  job_id     text,
  level      smallint,
  updated_at timestamptz not null default now()
);
create index characters_user_idx on public.characters (user_id);

-- ── 서비스별 현재 상태 (작업 중 빌드 + 공용 인벤토리 + 대상 몹 + n타) ──
create table public.user_state (
  user_id        uuid   not null references auth.users on delete cascade,
  app_id         text   not null,
  schema_version int    not null,
  payload        jsonb  not null,
  rev            bigint not null default 1,
  updated_at     timestamptz not null default now(),
  primary key (user_id, app_id)
);

-- ── 서비스별 저장 슬롯 ────────────────────────────────────────
create table public.user_slots (
  user_id        uuid     not null references auth.users on delete cascade,
  app_id         text     not null,
  idx            smallint not null,
  character_id   uuid     references public.characters(id) on delete set null,
  name           text,
  schema_version int      not null,
  saved_at       timestamptz not null,
  snapshot       jsonb    not null,
  rev            bigint   not null default 1,
  updated_at     timestamptz not null default now(),
  primary key (user_id, app_id, idx)
);

-- ── rev 자동 증가 (낙관적 잠금, §4) ───────────────────────────
create or replace function public.bump_rev()
returns trigger language plpgsql as $fn$
begin
  new.rev := old.rev + 1;
  new.updated_at := now();
  return new;
end;
$fn$;

create trigger user_state_bump before update on public.user_state
  for each row execute function public.bump_rev();
create trigger user_slots_bump before update on public.user_slots
  for each row execute function public.bump_rev();

-- ── RLS: 본인 행만 ────────────────────────────────────────────
alter table public.profiles   enable row level security;
alter table public.characters enable row level security;
alter table public.user_state enable row level security;
alter table public.user_slots enable row level security;

create policy own_profile on public.profiles for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy own_characters on public.characters for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy own_state on public.user_state for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy own_slots on public.user_slots for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

**RLS 활성화를 빠뜨리면 전 유저 데이터가 공개된다.** anon key는 번들에 노출되는 값이고 RLS가 유일한
방어선이다. 테이블 생성 후 Table Editor에서 자물쇠 표시를 반드시 확인할 것.

---

## §4 동기화 정책

- **진실의 원천은 서버.** 로그인 중에도 localStorage 영속화는 캐시로 계속 돌려 오프라인·새로고침에서
  즉시 렌더되게 둔다.
- **push**: 스토어 변경 구독 → 2초 디바운스 → **바뀐 행만** upsert. `visibilitychange`/`pagehide`에서 flush.
- **pull**: 로그인 직후 + 탭 포커스 복귀 시 `rev` 비교.
- **충돌**: `update ... where rev = <마지막으로 읽은 rev>`가 0행이면 다른 기기가 먼저 저장한 것이다.
  조용한 last-write-wins로 덮지 않고 다이얼로그를 띄운다(`서버 것 받기` / `내 것으로 덮기`).
- **오프라인**: 실패한 push는 큐에 쌓고 온라인 복귀 시 재시도.
- **`mlsv2:ui`(패널 접힘)는 동기화하지 않는다.** PC와 모바일은 접고 싶은 패널이 달라 서로 덮어쓴다.

### 스키마 버전

zustand `persist`의 `migrate`는 **localStorage 경로에만** 걸린다(`buildStore` v1, `inventoryStore` v1).
서버에서 받은 payload는 `applyAll()` 앞에서 같은 마이그레이션을 수동으로 태워야 한다.
안 태우면 구버전 스키마가 검증 없이 들어간다.

---

## §5 로컬 → 계정 이관

**계정이 기준이다.** 로그인하면 계정에 있는 것을 본다. 로그인 순간에 자동으로 합치거나 고르게 하지
않는다 — 처음 로그인하는 사람에게 세 갈래 선택지를 들이미는 게 이 앱에서 가장 어려운 화면이 됐다.
합치는 일은 나중에, 원할 때, 하나씩 한다(아래 '이 기기에서 불러오기').

로그인 완료 시점에 네 갈래로 나뉜다.

| 이 기기 | 계정 | 동작 |
|---|---|---|
| 없음 | 없음 | 아무 일도 없음 |
| 없음 | 있음 | 계정 것을 받아 표시 |
| **있음** | **있음** | **계정 기준으로 표시.** 덮이기 전에 이 기기 상태를 보관본으로 남긴다 |
| **있음** | **없음** | **"이 기기의 세팅을 계정에 올릴까요?"** → `올리기` / `나중에` |

마지막 칸이 사실상 첫 로그인이다(계정이 비었다 = 아직 한 번도 올린 적 없다).
`나중에`를 고르면 **동기화를 시작하지 않는다.** 올릴지 말지 답을 안 한 기기를 조용히 올려버리면
물어본 의미가 없다. 그 기기의 계정 메뉴에는 `계정에 올리기`가 대신 걸린다.

### 보관본

세 번째 칸에서 계정 것을 적용하기 **직전에** 이 기기 상태 한 벌을 `mlsv2:backup`에 남긴다
(마지막 1벌만 유지). 이게 없으면 '이 기기에서 불러오기'가 읽을 원본이 사라진다 — 계정 기준으로
표시하는 순간 localStorage가 계정 데이터로 덮이기 때문이다. 충돌에서 `계정 것만 쓰기`를 고를 때도
같은 보관을 한다.

### 이 기기에서 불러오기

계정 메뉴(우상단 디스코드 버튼) → `이 기기에서 불러오기`. 보관본을 읽어 항목별로 보여준다.

- 보관본의 **저장 슬롯**들
- **작업하던 빌드** — 슬롯에 저장하지 않은 것. 제일 잃기 쉬워서 항목으로 올린다
- **공용 인벤토리** — 계정에 없는 것만 더한다(id가 겹치면 이미 같은 것)

옮기기는 **한 번에 하나씩**이다: 항목 고르기 → 계정의 어느 칸에 넣을지 고르기. 저장 슬롯 화면이
이미 칸을 눌러 조작하는 방식이라 따로 배울 게 없다. 이미 쓰는 칸을 고르면 그 내용은 덮인다.

통째로 되돌릴 때만 아래쪽 **전체 덮어쓰기**를 쓴다(되묻는다).

---

## §6 코드 배치

기존 레이어 방향(`components → store → data → domain`)을 그대로 지킨다.

```
src/data/cloud/supabase.ts    클라이언트 싱글턴 + 쿠키 세션 어댑터
src/data/cloud/userData.ts    DTO ↔ 도메인 정규화, fetch/upsert
src/data/cloud/sync.ts        push/pull·디바운스·충돌 (앱 비의존)
src/store/authStore.ts        세션·프로필 (persist 하지 않음 — supabase가 관리)
src/store/cloudSync.ts        snapshot.ts를 물려 sync를 기동
src/store/cloudSchema.ts      서버 payload 전용 마이그레이션
src/components/AuthButton.tsx     TopBar 버튼 + 계정 메뉴
src/components/CloudSyncGate.tsx  로그인 ↔ 동기화 연결 + 확인 다이얼로그
src/components/LocalImportDialog.tsx  '이 기기에서 불러오기'
```

- `captureAll()` / `applyAll()`은 **`store/snapshot.ts`에 둔다.** 그 파일이 "여러 스토어를 묶는 유일한 곳"
  이라는 기존 역할과 정확히 같다. `data/cloud/`는 스토어를 직접 import하지 않는다.
- **`data/cloud/`는 이 앱의 도메인 타입을 몰라야 한다.** payload를 `unknown`으로 다루고 캡처/복원 함수를
  주입받는 형태로 짠다. 두 번째 서비스에서 폴더를 그대로 복사하거나 패키지로 승격할 수 있게 하기 위함이다.
  `BuildSnapshot`을 직접 참조해 짜두면 다음 서비스에서 반드시 다시 쓰게 된다.

```ts
createCloudSync({ appId, captureAll, applyAll, migratePayload })
```

---

## §7 콘솔 세팅 절차

코드 배포 전에 아래를 먼저 마쳐야 한다. 전부 웹 콘솔 작업이다.

### A. Supabase 프로젝트

1. <https://supabase.com/dashboard> → **New project**
   - Region: **Northeast Asia (Seoul)** — 사용자가 국내라 지연이 가장 낮다
   - DB 비밀번호는 따로 보관(이 앱은 쓰지 않지만 분실 시 재설정이 번거롭다)
2. **Project Settings → API**에서 두 값을 복사해 둔다
   - `Project URL` (`https://<ref>.supabase.co`)
   - `anon` `public` key — 번들에 노출되는 공개값이다(RLS가 방어선)
3. **SQL Editor → New query**에 §3의 DDL 전체를 붙여 넣고 **Run**
4. **Table Editor**에서 `profiles`·`characters`·`user_state`·`user_slots` 4개가 생겼고
   모두 **RLS enabled**(자물쇠)인지 확인

### B. 디스코드 애플리케이션

1. <https://discord.com/developers/applications> → **New Application** (예: `Mapleland Tools`)
2. **OAuth2 → Redirects**에 아래 한 줄 추가 후 **Save Changes**
   ```
   https://<ref>.supabase.co/auth/v1/callback
   ```
   `<ref>`는 A-2의 Project URL에 있는 값이다.
3. **OAuth2 → Client ID** 와 **Client Secret**을 복사
   (Secret은 `Reset Secret`을 눌러야 보일 수 있다)
4. (선택) **General Information**의 아이콘·설명은 로그인 동의 화면에 그대로 노출된다

### C. Supabase에 디스코드 연결

1. **Authentication → Sign In / Providers → Discord** → Enable
2. B-3의 Client ID / Client Secret 입력 → Save
3. **Authentication → URL Configuration**
   - **Site URL**: `https://item.mapleland.st`
   - **Redirect URLs**: 아래 세 줄을 각각 추가
     ```
     https://item.mapleland.st/**
     https://*.mapleland.st/**
     http://localhost:5173/**
     ```

### D. 환경변수

Vercel → Project Settings → Environment Variables (Production·Preview·Development 전부):

```
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key>
VITE_APP_ID=item-sim
```

로컬 개발은 레포 루트 `.env.local`에 같은 값을 넣는다(`.gitignore` 대상).
**세 값이 없으면 앱은 로그인 UI를 숨기고 기존 localStorage 전용으로 동작한다** — 키 없이도 빌드·실행된다.

### E. 다음 서비스를 붙일 때

A~C를 반복할 필요가 없다. 해야 할 일은 두 가지뿐이다.

1. Supabase **Redirect URLs** 확인 — `https://*.mapleland.st/**`로 이미 덮인다
2. 그 서비스의 `VITE_APP_ID`를 다른 값으로 준다 (예: `skill-sim`)

---

## §8 결정 이력

- **Supabase 채택** — Neon/Turso/D1은 무료 용량이 더 크지만(5GB) 디스코드 OAuth를 직접 구현해야 해서
  토큰 교환·세션 쿠키·CSRF state·CRUD API로 서버 함수가 3~4개 늘어난다. Firebase는 디스코드를
  지원하지 않아 커스텀 토큰 서버가 필요하다. 이 앱의 서버 코드는 `api/feedback.js` 하나뿐이고
  그 상태를 유지하는 쪽이 유지비가 낮다.
- **한 프로젝트 · 한 디스코드 앱** — 계정 공유가 요건이므로 분리 불가(§2).
- **쿠키 세션** — 전 서비스가 `*.mapleland.st` 서브도메인이라 가능해진 선택. 다른 루트 도메인이었다면
  서비스마다 로그인 버튼을 눌러야 했다.
- **`characters` 선반영** — 컬럼 하나를 비워두는 비용 0 vs 나중에 두 서비스를 동시 마이그레이션(§3).
- **로그인 순간의 3지선다 폐기** — 처음엔 `계정 것 / 이 기기 것 / 병합` 셋을 물었는데, 첫 화면치고
  읽을 게 너무 많았다. `계정이 기준`으로 단순화하고 합치는 일은 '이 기기에서 불러오기'로 미뤘다(§5).
  덕분에 자동 병합 규칙(빈 칸 채우기 + '이 기기 빌드' 슬롯 생성)도 함께 없앴다.
