-- ライブラリ（要約履歴）用の read-model view。
--
-- 背景:
--   履歴は利用ログ requests（§3.6）から派生する。1 動画につき複数 requests 行が
--   ありうる（再閲覧のたびに insert）。一覧では video_id で重複排除し、最終閲覧の
--   新しい順に並べたい。これをアプリ側で毎回 dedup するのは漏れやすいので、
--   view で構造的に担保する。
--
-- 方針:
--   - distinct on (user_id, video_id): (ユーザー, 動画) ごとに最新 request の 1 行に畳む。
--   - last_viewed_at = その最新 request の created_at。
--   - requests join videos: タイトル / チャンネル名を同梱（サムネは videoId から
--     クライアント側で導出するため列に持たない）。
--   - video_id is not null: requests.video_id は on delete set null で NULL がありうる。
--     join で既に NULL 行は落ちるが、意図を明示するため where でも除外する。
--   - security_invoker = true: view を直接 SELECT する主体（例: authenticated）の
--     RLS を下位テーブルに適用させ、view 経由の RLS バイパスを防ぐ。
--     （backend は service_role で叩き user_id を明示フィルタするが、将来の直接参照に備える）
--
-- 利用側（library.history procedure）:
--   .eq("user_id", ...).order("last_viewed_at", desc).order("video_id", asc).range(...)
--   で user 単位に絞り offset ページングする。

create view public.user_summary_history
with (security_invoker = true)
as
select distinct on (r.user_id, r.video_id)
  r.user_id,
  r.video_id,
  r.created_at as last_viewed_at,
  v.title,
  v.channel_name
from public.requests r
join public.videos v on v.id = r.video_id
where r.video_id is not null
order by r.user_id, r.video_id, r.created_at desc;

-- 権限付与。
--   - service_role: backend（library.history）が service_role キーで SELECT する。
--     default privileges に頼らず明示付与し「permission denied for view」を防ぐ。
--   - authenticated: 直接参照に備えた最小付与。security_invoker=true のため
--     requests_select_own（自分の行のみ）が効き、他人の履歴は見えない。
grant select on public.user_summary_history to service_role;
grant select on public.user_summary_history to authenticated;
