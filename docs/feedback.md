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
  -- 첨부 이미지의 스토리지 경로 (`<user_id>/<feedback_id>/<uuid>.<ext>`). §3 참고
  images        text[] not null default '{}',
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

> 위 DDL을 이미 한 번 돌린 뒤라면 첨부 이미지 컬럼만 따로 추가한다:
> `alter table public.feedbacks add column if not exists images text[] not null default '{}';`

---

## §3 첨부 이미지

버그 제보는 스크린샷 한 장이 설명 열 줄보다 낫다. Supabase Storage에 올리고 경로만
`feedbacks.images`에 담는다.

**버킷은 비공개다.** 문의 자체가 기본 비공개인데 이미지만 공개 URL로 열리면 앞뒤가 안 맞는다.
읽을 때마다 서명 URL(1시간)을 만들어 쓴다. 정책이 세 부류를 통과시킨다 — 본인, 어드민,
그리고 **공개 처리된 문의의 이미지**(대문이 anon key로 서명 URL을 만들 수 있어야 한다).

경로를 `<user_id>/<feedback_id>/<uuid>.<ext>`로 잡은 건 정책에서 폴더 이름만으로 판정하기
위해서다 — 1번째 조각이 소유자, 2번째가 문의 id다.

```sql
-- 비공개 버킷 (이미 있으면 건너뛴다)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('feedback', 'feedback', false, 5242880,
        array['image/png', 'image/jpeg', 'image/gif', 'image/webp'])
on conflict (id) do nothing;

-- 자기 폴더에만 올린다
create policy feedback_images_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'feedback'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 본인 · 어드민 · 공개된 문의의 이미지
create policy feedback_images_read on storage.objects
  for select
  using (
    bucket_id = 'feedback'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
      or exists (
        select 1 from public.feedbacks f
         where f.is_public
           and f.id::text = (storage.foldername(name))[2]
      )
    )
  );

-- 정리는 어드민만
create policy feedback_images_delete on storage.objects
  for delete using (bucket_id = 'feedback' and public.is_admin());
```

앱은 한 건당 **3장 · 장당 5MB · 이미지 타입만** 받는다(버킷 설정과 클라이언트 양쪽에서 건다).

문의 행을 넣기 전에 id를 클라이언트에서 만들어(`crypto.randomUUID()`) 그 id로 업로드한다.
행 삽입이 실패하면 이미지가 고아로 남지만, 비공개 버킷이라 누구에게도 보이지 않는다.

---

## §4 대문 크롤링

`mapleland.st` 대문은 **같은 Supabase 프로젝트의 anon key**로 `feedbacks`를 읽으면 된다.
서버 코드도, 별도 API도 필요 없다. RLS가 `is_public = true`인 행만 내보낸다.

```js
// 대문 프로젝트에서
const { data } = await supabase
  .from('feedbacks')
  .select('id, app_id, type, title, body, status, author_name, author_avatar, images, created_at')
  .eq('is_public', true)
  .order('created_at', { ascending: false })
  .limit(50)
```

답변까지 함께 보이려면 `feedback_replies`를 같이 읽는다 — 공개 문의의 답변은 같은 정책으로 열린다.

첨부 이미지는 경로만 담겨 있으니 서명 URL을 만들어 쓴다. 공개 문의의 이미지는 anon key로도
서명이 되도록 정책이 열려 있다(§3).

```js
const { data: signed } = await supabase.storage
  .from('feedback')
  .createSignedUrls(row.images, 3600)
```

> **대문에서 이미지를 목록에 깔지 말 것.** 무료 한도의 병목은 저장 용량(1GB)이 아니라
> 전송량(월 5GB)이다. 방문자 1,000명이 목록에서 이미지 10장을 보면 700KB짜리 기준
> 하루 7GB로 월 한도를 하루 만에 넘긴다. 게다가 서명 URL은 매번 토큰이 달라 CDN 캐시가
> 먹지 않는다 — 같은 이미지를 100명이 봐도 100번 전송된다.
>
> 제목만 띄우고 상세를 펼칠 때 로드하거나, 같은 TTL 안에서는 서명 URL을 재사용할 것.
> 문의량이 늘어 저장 용량이 빠듯해지면 업로드 전 클라이언트 축소(긴 변 1600px + WEBP)를
> 넣는다. Supabase의 서버측 리사이즈는 유료 플랜 전용이다.

**공개되면 작성자 디스코드 닉네임도 같이 나간다.** 어드민이 `is_public`을 켜기 전에 본문을
한 번 읽게 되는 구조라(답변하면서 켠다) 실수로 개인정보가 나가는 경로는 막혀 있다.

---

## §5 화면

| 화면 | 위치 | 누가 |
|---|---|---|
| 문의 작성 | 상단 `문의하기` | 로그인한 사용자. 비로그인이면 로그인 안내만 |
| 내 문의 | 계정 메뉴 → `내 문의` | 본인 문의 + 답변 열람 |
| 문의 관리 | 계정 메뉴 → `문의 관리` | **어드민에게만 보인다** |

`문의 관리`는 상태로 거른 목록에서 답변을 쓰고, 상태와 공개 여부를 바꾼다.

데이터 접근은 `src/data/cloud/feedback.ts`에 모았다. 앱 도메인 타입을 쓰지 않으므로 나중에
어드민 화면을 별도 서비스(`admin.mapleland.st`)로 옮길 때 이 파일만 가져가면 된다.

---

## §6 디스코드 알림

문의가 들어오면 운영자 디스코드로 알림이 온다. 운영자 서버의 비공개 채널에 **웹후크**로 메시지를
남기면서 운영자 계정을 `@멘션`해 푸시를 받는 방식이다.

- **DB 트리거가 보낸다.** `feedbacks`에 행이 들어가면 `pg_net`이 웹후크로 POST한다. 서버 코드도,
  Edge Function도, 봇도 없다. 브라우저는 알림의 존재를 모른다.
- **웹후크 URL은 Supabase Vault에 둔다.** URL만 있으면 누구나 그 채널에 글을 쓸 수 있으니
  레포·`.env`·브라우저 어디에도 두지 않는다. 운영자 디스코드 ID도 같은 곳에 둔다.
- **알림이 실패해도 문의 접수는 막지 않는다.** `pg_net`은 요청을 큐에 넣고 바로 돌아오고(비동기),
  큐에 넣는 것조차 실패하면 경고만 남긴다. Vault에 URL이 없으면 조용히 건너뛴다.
- **본문은 embed에 넣고 멘션은 운영자 한 명으로 못 박는다**(`allowed_mentions`). 사용자가 본문에
  `@everyone`을 적어도 아무도 호출되지 않는다.
- **비공개 문의 본문이 채널에 그대로 찍힌다.** 채널을 운영자만 보이게 둘 것.
- **같은 Supabase 프로젝트의 모든 서비스 문의에 울린다**(§2 `app_id`). 메시지에 서비스를 표시한다.

### 콘솔 세팅

1. 디스코드 운영자 서버 → 알림 받을 **비공개 채널** → 채널 편집 → 연동 → 웹후크 → 새 웹후크 →
   URL 복사
2. 디스코드 설정 → 고급 → **개발자 모드** 켜기 → 내 프로필 우클릭 → **사용자 ID 복사**
3. Supabase Dashboard → SQL Editor에서 비밀값 두 개를 넣는다(한 번만).

```sql
select vault.create_secret('<웹후크 URL>',        'feedback_discord_webhook');
select vault.create_secret('<내 디스코드 사용자 ID>', 'feedback_discord_user_id');
```

> 값을 바꿀 때는 `create_secret`를 다시 부르지 말고(이름 중복으로 실패한다)
> `select vault.update_secret(id, '<새 값>') from vault.secrets where name = '<이름>';`

4. 아래 DDL을 붙여 넣는다.

```sql
create extension if not exists pg_net with schema extensions;

create or replace function public.notify_feedback_discord()
returns trigger language plpgsql security definer set search_path = '' as $fn$
declare
  hook text;
  uid  text;
begin
  select decrypted_secret into hook
    from vault.decrypted_secrets where name = 'feedback_discord_webhook';
  select decrypted_secret into uid
    from vault.decrypted_secrets where name = 'feedback_discord_user_id';
  if hook is null then
    return new;
  end if;

  perform net.http_post(
    url  := hook,
    body := jsonb_build_object(
      'content', case when uid is null then '📮 새 문의' else format('<@%s> 📮 새 문의', uid) end,
      -- 운영자 한 명만 호출한다. 본문에 @everyone이 있어도 무시된다
      'allowed_mentions', jsonb_build_object(
        'parse', '[]'::jsonb,
        'users', case when uid is null then '[]'::jsonb else jsonb_build_array(uid) end
      ),
      'embeds', jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
        'title',       left(new.title, 256),
        'description', nullif(left(new.body, 1000)
                         || case when length(new.body) > 1000 then ' …' else '' end, ''),
        'color',       case new.type when 'bug' then 15548997 when 'idea' then 16705372 else 5793266 end,
        'fields', jsonb_build_array(
          jsonb_build_object('name', '유형', 'inline', true, 'value',
            case new.type when 'bug' then '🐛 버그 제보' when 'idea' then '💡 기능 건의' else '💬 기타' end),
          jsonb_build_object('name', '서비스', 'inline', true, 'value', new.app_id),
          jsonb_build_object('name', '작성자', 'inline', true, 'value', coalesce(new.author_name, '(이름 없음)')),
          jsonb_build_object('name', '첨부',   'inline', true, 'value', format('%s장', cardinality(new.images)))
        ),
        'footer',    jsonb_build_object('text', new.id::text),
        'timestamp', to_jsonb(new.created_at)
      )))
    )
  );
  return new;
exception when others then
  -- 알림 실패가 문의 접수를 막으면 안 된다
  raise warning 'notify_feedback_discord: %', sqlerrm;
  return new;
end;
$fn$;

drop trigger if exists feedbacks_notify_discord on public.feedbacks;
create trigger feedbacks_notify_discord
  after insert on public.feedbacks
  for each row execute function public.notify_feedback_discord();
```

5. 앱에서 문의를 하나 남겨 알림이 오는지 본다. 안 오면 웹후크 응답을 확인한다.

```sql
select created, status_code, content
  from net._http_response order by created desc limit 5;
```

알림을 끄려면 `drop trigger feedbacks_notify_discord on public.feedbacks;` 한 줄이면 된다.

---

## §7 결정 이력

- **GitHub 이슈 프록시 폐기** — 계정이 생겨 신원과 답변 경로가 앱 안에서 해결됐다.
  `api/feedback.js`가 사라지면서 이 레포의 서버 코드는 0이 됐다.
- **허니팟 제거** — 로그인 필수가 봇을 막는다. 숨긴 입력칸을 유지할 이유가 없다.
- **답변은 어드민만** — 사용자 재질문까지는 넓히지 않았다. 필요해지면
  `admin_write_replies`를 `is_admin() or 본인 문의`로 넓히면 되고, 표 구조는 그대로 쓴다.
- **어드민 화면을 앱 안에 둔 이유** — 이 앱엔 라우터가 없어 다이얼로그가 가장 싸다.
  서비스가 늘어 문의를 한곳에서 볼 필요가 생기면 §4의 데이터 접근 파일만 들고 나가면 된다.
- **알림은 봇 DM이 아니라 채널 웹후크 + 멘션** — DM은 봇 토큰과 Edge Function이 필요해 이 레포에
  서버 코드가 다시 생긴다. 웹후크는 DB 트리거 하나로 끝나고, 멘션으로 푸시도 똑같이 온다(§6).
