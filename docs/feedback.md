# 문의하기 (계정 기반)

문의를 Supabase에 쌓고, 사용자는 답변을 앱에서 확인한다. 어드민은 앱 안에서 모아 답변한다.
계정·DB 구성은 [docs/cloud-sync.md](cloud-sync.md)와 **같은 Supabase 프로젝트**를 쓴다.

---

## §1 무엇이 바뀌었나

예전에는 비로그인으로 폼을 채우면 서버리스 프록시(`api/feedback.js`)가 GitHub 이슈를 만들었다.
연락처를 손으로 적게 했고, 답변은 GitHub에서만 볼 수 있었다.

지금은 이렇다.

| | 전 | 후 |
|---|---|---|
| 로그인 | 불필요 | **필수** |
| 신원 | 사용자가 적은 연락처 문자열 | 디스코드 계정 |
| 저장소 | GitHub 이슈 | Supabase `feedbacks` |
| 답변 확인 | GitHub | 앱 안 `내 문의` |
| 서버 코드 | `api/feedback.js` | **없음** (RLS로 브라우저 직결) |

폼 자체(유형·제목·내용)는 그대로 두었다. 연락처 칸과 스팸 허니팟만 빠졌다 —
로그인이 신원을 대신하고, 로그인 자체가 봇을 막는다.

---

## §2 스키마

### 설계 결정

- **문의와 답변을 나눈다.** 답변이 1:N이어야 상태를 바꾸지 않고 설명을 덧붙일 수 있다.
- **작성자 이름을 행에 스냅샷한다**(`author_name`/`author_avatar`). `profiles`를 조인하지 않아도
  되고, `profiles`를 공개하지 않고도 대문에서 공개 문의를 렌더할 수 있다. 닉네임이 바뀌어도
  당시 기록이 남는다.
- **`is_public`은 기본 false다.** 대문 노출은 어드민이 답변하면서 고르는 것이지, 사용자가 쓴
  순간 공개되는 게 아니다. 공개하면 **작성자 디스코드 닉네임도 함께 공개된다**.
- **`app_id`로 서비스를 가른다.** 스킬 시뮬에서 온 문의도 같은 표에 쌓이고, 대문에서는 전부
  모아 보여줄 수 있다(cloud-sync.md §3과 같은 이유).
- **어드민은 `admins` 테이블로 정한다.** JWT 클레임을 건드리는 것보다 콘솔에서 행 하나 넣는
  쪽이 싸고, RLS에서 바로 참조된다.

### DDL

Supabase Dashboard → SQL Editor에 그대로 붙여 넣는다.

```sql
-- ── 어드민 명단 ───────────────────────────────────────────────
create table public.admins (
  user_id uuid primary key references auth.users on delete cascade,
  note    text
);

-- RLS 안에서 쓰는 판별 함수. security definer라 admins의 RLS를 우회해 읽는다
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $fn$
  select exists (select 1 from public.admins a where a.user_id = auth.uid())
$fn$;

-- ── 문의 ─────────────────────────────────────────────────────
create table public.feedbacks (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users on delete cascade,
  app_id        text not null,
  type          text not null default 'etc' check (type in ('bug', 'idea', 'etc')),
  title         text not null,
  body          text not null,
  status        text not null default 'open'
                check (status in ('open', 'answered', 'resolved', 'wontfix')),
  -- 대문 노출 여부. 어드민이 켠다 (§2 설계 결정)
  is_public     boolean not null default false,
  -- 작성 시점 디스코드 프로필 스냅샷
  author_name   text,
  author_avatar text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index feedbacks_user_idx   on public.feedbacks (user_id, created_at desc);
create index feedbacks_public_idx on public.feedbacks (is_public, created_at desc);

-- ── 답변 (어드민만 작성) ──────────────────────────────────────
create table public.feedback_replies (
  id          uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.feedbacks(id) on delete cascade,
  author_id   uuid not null references auth.users,
  body        text not null,
  created_at  timestamptz not null default now()
);
create index feedback_replies_idx on public.feedback_replies (feedback_id, created_at);

-- ── 답변이 달리면 상태를 answered로 (이미 처리한 건은 건드리지 않는다) ──
create or replace function public.mark_answered()
returns trigger language plpgsql security definer set search_path = '' as $fn$
begin
  update public.feedbacks
     set status = 'answered', updated_at = now()
   where id = new.feedback_id and status = 'open';
  return new;
end;
$fn$;

create trigger feedback_replies_mark_answered
  after insert on public.feedback_replies
  for each row execute function public.mark_answered();

-- ── RLS ──────────────────────────────────────────────────────
alter table public.admins           enable row level security;
alter table public.feedbacks        enable row level security;
alter table public.feedback_replies enable row level security;

-- 자기 행만 본다. 어드민 여부를 화면에서 알기 위한 것뿐이고,
-- 실제 권한은 아래 정책들이 is_admin()으로 건다
create policy own_admin_row on public.admins
  for select using (user_id = auth.uid());

-- 공개 문의는 로그인하지 않아도 읽힌다 (대문 크롤링, §3)
create policy read_feedbacks on public.feedbacks
  for select using (is_public or user_id = auth.uid() or public.is_admin());

-- 로그인해야 쓴다. anon은 auth.uid()가 null이라 자동으로 막힌다
create policy write_feedbacks on public.feedbacks
  for insert with check (user_id = auth.uid());

-- 상태·공개 여부는 어드민만 바꾼다
create policy admin_update_feedbacks on public.feedbacks
  for update using (public.is_admin()) with check (public.is_admin());
create policy admin_delete_feedbacks on public.feedbacks
  for delete using (public.is_admin());

-- 답변은 그 문의를 볼 수 있으면 읽힌다
create policy read_replies on public.feedback_replies
  for select using (
    exists (
      select 1 from public.feedbacks f
       where f.id = feedback_id
         and (f.is_public or f.user_id = auth.uid() or public.is_admin())
    )
  );

-- 답변 작성은 어드민만
create policy admin_write_replies on public.feedback_replies
  for all using (public.is_admin()) with check (public.is_admin());
```

어드민 등록은 콘솔에서 한 줄이다.

```sql
insert into public.admins (user_id, note)
select id, '운영자' from auth.users where email = '<내 디스코드 이메일>';
```

---

## §3 대문 크롤링

`mapleland.st` 대문은 **같은 Supabase 프로젝트의 anon key**로 `feedbacks`를 읽으면 된다.
서버 코드도, 별도 API도 필요 없다. RLS가 `is_public = true`인 행만 내보낸다.

```js
// 대문 프로젝트에서
const { data } = await supabase
  .from('feedbacks')
  .select('id, app_id, type, title, body, status, author_name, author_avatar, created_at')
  .eq('is_public', true)
  .order('created_at', { ascending: false })
  .limit(50)
```

답변까지 함께 보이려면 `feedback_replies`를 같이 읽는다 — 공개 문의의 답변은 같은 정책으로 열린다.

**공개되면 작성자 디스코드 닉네임도 같이 나간다.** 어드민이 `is_public`을 켜기 전에 본문을
한 번 읽게 되는 구조라(답변하면서 켠다) 실수로 개인정보가 나가는 경로는 막혀 있다.

---

## §4 화면

| 화면 | 위치 | 누가 |
|---|---|---|
| 문의 작성 | 상단 `문의하기` | 로그인한 사용자. 비로그인이면 로그인 안내만 |
| 내 문의 | 계정 메뉴 → `내 문의` | 본인 문의 + 답변 열람 |
| 문의 관리 | 계정 메뉴 → `문의 관리` | **어드민에게만 보인다** |

`문의 관리`는 상태로 거른 목록에서 답변을 쓰고, 상태와 공개 여부를 바꾼다.

데이터 접근은 `src/data/cloud/feedback.ts`에 모았다. 앱 도메인 타입을 쓰지 않으므로 나중에
어드민 화면을 별도 서비스(`admin.mapleland.st`)로 옮길 때 이 파일만 가져가면 된다.

---

## §5 결정 이력

- **GitHub 이슈 프록시 폐기** — 계정이 생겨 신원과 답변 경로가 앱 안에서 해결됐다.
  `api/feedback.js`가 사라지면서 이 레포의 서버 코드는 0이 됐다.
- **허니팟 제거** — 로그인 필수가 봇을 막는다. 숨긴 입력칸을 유지할 이유가 없다.
- **답변은 어드민만** — 사용자 재질문까지는 넓히지 않았다. 필요해지면
  `admin_write_replies`를 `is_admin() or 본인 문의`로 넓히면 되고, 표 구조는 그대로 쓴다.
- **어드민 화면을 앱 안에 둔 이유** — 이 앱엔 라우터가 없어 다이얼로그가 가장 싸다.
  서비스가 늘어 문의를 한곳에서 볼 필요가 생기면 §4의 데이터 접근 파일만 들고 나가면 된다.
