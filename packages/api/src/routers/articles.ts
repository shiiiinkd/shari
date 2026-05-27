/**
 * 関連記事 procedure。
 * Qiita / Zenn から関連技術記事を取得して返す。
 *
 * キャッシュ戦略（MVP）:
 *   - **キャッシュは一切持たない**。記事リストも OGP も毎回フレッシュに取得する。
 *   - 理由: Qiita は日次で新着が出るため記事リスト cache は新鮮さを損なう。OGP cache を
 *     DB に持つと SSOT が Qiita 側にあるのに我々の DB がコピーを抱える設計負債が発生する。
 *     （docs/architecture.md への反映は後続 PR で対応予定）
 *   - 1 リクエストあたりのサブリクエスト: Qiita 1 + OGP 3 = 4。Workers 無料枠 50 に余裕。
 *   - 応答時間: ~1〜3s。要約本体（20〜40s）に比べて誤差。
 *
 * 処理フロー:
 *   1. videos.title を引いて検索クエリを作る
 *   2. Qiita / Zenn を並列検索
 *   3. enrichWithOgp で OGP プレビューを並列取得（各 2s タイムアウト）
 *   4. mobile に返す
 *
 * 認証: protectedProcedure。記事閲覧履歴を将来取りたいので user_id を確保する。
 *
 * 前提:
 *   - videos テーブルに該当 video_id が無いと検索クエリが作れない
 *     → 通常は summary.create が先に走って videos を埋めている想定
 *     → 無い場合は NOT_FOUND で返し、mobile に summary.create を先行させてもらう
 *
 * 既知の負債:
 *   related_articles テーブルは「将来クリック計測などで使うかも」枠で残しているが、
 *   現状この procedure からは書き込まない。完全に未使用が確定したら drop。
 */
import { articlesRelatedForInputSchema, articlesRelatedForOutputSchema } from "@shari/shared";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { enrichWithOgp, searchQiita, searchZenn } from "../services/articles.js";
import { protectedProcedure, router } from "../trpc.js";

// 関連記事の最大表示件数。Slack 風プレビュー（画像つき）はスクロール量が大きく、
// 上位 3 件で関連度の高い記事をしっかり見せる方針。OGP fetch の並列数 = 3 にもなる。
const MAX_ARTICLES_RETURNED = 3;

const videoTitleRowSchema = z.object({
  title: z.string().min(1),
});

export const articlesRouter = router({
  // 副作用（DB 書き込み）はもう無いので本来 query で良いが、useQuery の自動再実行で
  // Qiita API を多重に叩くのを避けたいため mutation に倒している。
  // useMutation はユーザー操作（マウント時 useEffect → 再試行ボタン）でのみ走る。
  relatedFor: protectedProcedure
    .input(articlesRelatedForInputSchema)
    .output(articlesRelatedForOutputSchema)
    .mutation(async ({ input, ctx }) => {
      const { videoId } = input;

      // 1. videos からクエリ用タイトルを引く
      const videoRow = await ctx.supabase
        .from("videos")
        .select("title")
        .eq("id", videoId)
        .maybeSingle();

      if (videoRow.error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `video_lookup_failed: ${videoRow.error.message}`,
        });
      }

      if (!videoRow.data) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "video_not_cached: summary.create を先に呼んでください",
        });
      }

      const { title } = videoTitleRowSchema.parse(videoRow.data);

      // 2. Qiita / Zenn 並列検索（Workers サブリクエスト消費 = 最大 2）
      const [qiitaResults, zennResults] = await Promise.all([
        searchQiita(title, { token: ctx.env.QIITA_TOKEN }),
        searchZenn(title),
      ]);

      const merged = [...qiitaResults, ...zennResults]
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        .slice(0, MAX_ARTICLES_RETURNED);

      if (merged.length === 0) {
        return { articles: [] };
      }

      // 3. OGP メタ取得（並列・各 fetch にタイムアウト）
      const enriched = await enrichWithOgp(merged);

      return { articles: enriched };
    }),
});
