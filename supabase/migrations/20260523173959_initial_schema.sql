-- shari MVP 初期スキーマ
-- 設計判断と RLS 方針の根拠は docs/data-model.md §3〜§5 を参照。
-- ここはあくまで「実装」。なぜそうなっているかはドキュメント側に書く。

-- ============================================================
-- 1. extensions
-- ============================================================

create extension if not exists pgcrypto;      -- gen_random_uuid()
create extension if not exists moddatetime;   -- updated_at 自動更新

-- ============================================================
-- 2. profiles （auth.users を 1:1 拡張）
-- ============================================================

create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  plan         text        not null default 'free' check (plan in ('free', 'pro', 'team')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure moddatetime(updated_at);

-- 新規 auth.users INSERT に応じて profiles を自動作成。
-- 匿名サインインも auth.users に行が入るので同様に拾われる。
-- SECURITY DEFINER で RLS をバイパスする必要がある。
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 3. videos （キャッシュ・全ユーザー共有）
-- ============================================================

create table public.videos (
  id              text        primary key check (id ~ '^[A-Za-z0-9_-]{11}$'),
  title           text        not null,
  channel_name    text        not null,
  channel_id      text,
  duration_sec    integer     check (duration_sec > 0),
  published_at    timestamptz,
  has_transcript  boolean     not null default false,
  fetched_at      timestamptz not null default now()
);

-- ============================================================
-- 4. transcripts （キャッシュ・動画ごとに1行）
-- ============================================================

create table public.transcripts (
  video_id    text        primary key references public.videos(id) on delete cascade,
  language    text        not null,
  segments    jsonb       not null,
  text_length integer     not null,
  fetched_at  timestamptz not null default now()
);

-- ============================================================
-- 5. summaries （キャッシュ・Claude 生成物）
-- ============================================================

create table public.summaries (
  id              uuid        primary key default gen_random_uuid(),
  video_id        text        not null references public.videos(id) on delete cascade,
  language        text        not null default 'ja',
  summary_md      text        not null,
  model           text        not null,
  prompt_version  text        not null,
  input_tokens    integer,
  output_tokens   integer,
  created_at      timestamptz not null default now(),
  unique (video_id, language, prompt_version)
);

-- ============================================================
-- 6. related_articles （キャッシュ・Qiita / Zenn）
-- ============================================================

create table public.related_articles (
  id         uuid        primary key default gen_random_uuid(),
  video_id   text        not null references public.videos(id) on delete cascade,
  source     text        not null check (source in ('qiita', 'zenn')),
  url        text        not null,
  title      text        not null,
  score      numeric,
  fetched_at timestamptz not null default now(),
  unique (video_id, url)
);

-- ============================================================
-- 7. requests （利用ログ・Free 上限判定用）
-- ============================================================

create table public.requests (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  video_id   text        not null references public.videos(id),
  cache_hit  boolean     not null,
  created_at timestamptz not null default now()
);

create index requests_user_created_idx
  on public.requests (user_id, created_at desc);

-- ============================================================
-- 8. subscriptions （Stripe 等課金連携の器）
-- ============================================================

create table public.subscriptions (
  user_id                  uuid        primary key references auth.users(id) on delete cascade,
  plan                     text        not null check (plan in ('free', 'pro', 'team')),
  provider                 text,
  provider_subscription_id text,
  current_period_end       timestamptz,
  updated_at               timestamptz not null default now()
);

create trigger subscriptions_updated_at
  before update on public.subscriptions
  for each row execute procedure moddatetime(updated_at);

-- ============================================================
-- 9. RLS （Row Level Security）
-- ============================================================
-- 方針: 書き込み系（INSERT / UPDATE / DELETE）は service_role でのみ実行する前提。
-- そのため CREATE POLICY は SELECT / UPDATE のみ記述し、書き込みポリシーは敢えて作らない。
-- = anon / authenticated は書き込み拒否（RLS デフォルト動作）。
-- service_role は RLS をバイパスするので backend からの書き込みは通る。

alter table public.profiles         enable row level security;
alter table public.videos           enable row level security;
alter table public.transcripts      enable row level security;
alter table public.summaries        enable row level security;
alter table public.related_articles enable row level security;
alter table public.requests         enable row level security;
alter table public.subscriptions    enable row level security;

-- パターン A: 自分の行のみ可視
create policy profiles_select_own
  on public.profiles for select to authenticated
  using (auth.uid() = id);

create policy profiles_update_own
  on public.profiles for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy requests_select_own
  on public.requests for select to authenticated
  using (auth.uid() = user_id);

create policy subscriptions_select_own
  on public.subscriptions for select to authenticated
  using (auth.uid() = user_id);

-- パターン B: キャッシュ系は認証済み全 SELECT 可
create policy videos_select_all
  on public.videos for select to authenticated
  using (true);

create policy transcripts_select_all
  on public.transcripts for select to authenticated
  using (true);

create policy summaries_select_all
  on public.summaries for select to authenticated
  using (true);

create policy related_articles_select_all
  on public.related_articles for select to authenticated
  using (true);
