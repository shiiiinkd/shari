-- requests.video_id の削除挙動を明示的に on delete set null へ変更。
--
-- 背景:
--   initial_schema.sql で requests.video_id は references public.videos(id)
--   のみで on delete 句が無いため、デフォルトの NO ACTION (RESTRICT 相当) になる。
--   transcripts / summaries / related_articles は cascade で消えるのに対し、
--   requests だけ残って videos の削除をブロックする状態だった。
--
-- 方針:
--   - 利用ログ（requests）は集計のために残したい
--   - 動画キャッシュ（videos）を将来クリーンアップしたい
--   → video_id を nullable + on delete set null。ログは残し、参照先が消えても安全。
--
-- 既存行への影響:
--   nullable 化のみで現データは破壊しない。FK 制約は drop → 再作成で挙動だけ差し替え。

alter table public.requests
  alter column video_id drop not null;

alter table public.requests
  drop constraint requests_video_id_fkey;

alter table public.requests
  add constraint requests_video_id_fkey
  foreign key (video_id) references public.videos(id) on delete set null;
