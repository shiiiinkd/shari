-- translations: 字幕→日本語訳の中間キャッシュ
-- 設計判断は docs/data-model.md §3.3.1 / §6 参照。
-- 要約の前段に翻訳ステップを挟むことで、英語動画の要約品質を底上げする。
-- 翻訳は「言語ペア → 意味保存写像」で揺れが小さい想定のため、PK には prompt_version を含めない。

create table public.translations (
  video_id         text        not null references public.videos(id) on delete cascade,
  source_language  text        not null,
  target_language  text        not null,
  translated_text  text        not null,
  model            text        not null,
  prompt_version   text        not null,
  input_tokens     integer,
  output_tokens    integer,
  created_at       timestamptz not null default now(),
  primary key (video_id, source_language, target_language),
  -- 同言語ペア（例: ja → ja）は翻訳不要なので、保険として DB 側でも弾く。
  -- 呼び出し側でもスキップする想定だが、ここで保証しておくと無駄行が増えない。
  check (source_language <> target_language)
);

-- RLS: 既存キャッシュ系（videos / transcripts / summaries / related_articles）と揃える。
-- 認証済みユーザーは SELECT 可、書き込みは service_role のみ（policy を作らないことで拒否される）。
alter table public.translations enable row level security;

create policy translations_select_all
  on public.translations for select to authenticated
  using (true);
