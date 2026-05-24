/**
 * 関連記事 procedure。
 * Qiita / Zenn から関連技術記事を取得して返す。
 *
 * 処理フロー:
 *   1. related_articles キャッシュ（fetched_at が 7 日以内）を確認
 *   2. Hit → DB の中身をそのまま返却
 *   3. Miss → videos.title をクエリにして Qiita / Zenn 並列検索
 *      → 結果を related_articles に upsert（unique (video_id, url) で重複を握りつぶす）
 *
 * 認証: protectedProcedure。記事閲覧履歴を将来取りたいので user_id を確保する。
 *
 * 前提:
 *   - videos テーブルに該当 video_id が無いと検索クエリが作れない
 *     → 通常は summary.create が先に走って videos を埋めている想定
 *     → 無い場合は NOT_FOUND で返し、mobile に summary.create を先行させてもらう
 */
import {
  articlesRelatedForInputSchema,
  articlesRelatedForOutputSchema,
  type RelatedArticle,
  relatedArticleSchema,
} from "@shari/shared";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { searchQiita, searchZenn } from "../services/articles.js";
import { protectedProcedure, router } from "../trpc.js";

const CACHE_TTL_DAYS = 7;
const MAX_ARTICLES_RETURNED = 6;

const cachedArticleRowSchema = z.object({
  source: z.enum(["qiita", "zenn"]),
  url: z.string().url(),
  title: z.string(),
  score: z.number().nullable(),
});

const videoTitleRowSchema = z.object({
  title: z.string().min(1),
});

export const articlesRouter = router({
  relatedFor: protectedProcedure
    .input(articlesRelatedForInputSchema)
    .output(articlesRelatedForOutputSchema)
    .query(async ({ input, ctx }) => {
      const { videoId } = input;
      const sevenDaysAgo = new Date(
        Date.now() - CACHE_TTL_DAYS * 24 * 60 * 60 * 1000,
      ).toISOString();

      // 1. キャッシュ確認
      const cachedRes = await ctx.supabase
        .from("related_articles")
        .select("source, url, title, score")
        .eq("video_id", videoId)
        .gte("fetched_at", sevenDaysAgo)
        .order("score", { ascending: false })
        .limit(MAX_ARTICLES_RETURNED);

      if (cachedRes.error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `related_articles_cache_lookup_failed: ${cachedRes.error.message}`,
        });
      }

      if (cachedRes.data && cachedRes.data.length > 0) {
        const parsed = z.array(cachedArticleRowSchema).parse(cachedRes.data);
        const articles: RelatedArticle[] = parsed.map((r) =>
          relatedArticleSchema.parse({
            source: r.source,
            url: r.url,
            title: r.title,
            score: r.score ?? undefined,
          }),
        );
        return { articles, cacheHit: true };
      }

      // 2. videos からクエリ用タイトルを引く
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

      // 3. Qiita / Zenn 並列検索（Workers サブリクエスト消費 = 最大 2）
      const [qiitaResults, zennResults] = await Promise.all([
        searchQiita(title, { token: ctx.env.QIITA_TOKEN }),
        searchZenn(title),
      ]);

      const merged = [...qiitaResults, ...zennResults]
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        .slice(0, MAX_ARTICLES_RETURNED);

      if (merged.length === 0) {
        return { articles: [], cacheHit: false };
      }

      // 4. キャッシュへ upsert。unique (video_id, url) で重複は握りつぶす。
      //    fetched_at を明示更新しないと、既存行に衝突した時に default(now()) が走らず
      //    fetched_at が古いまま固定され、CACHE_TTL_DAYS で永遠に Miss 扱いになる。
      const fetchedAt = new Date().toISOString();
      const upsertRes = await ctx.supabase.from("related_articles").upsert(
        merged.map((a) => ({
          video_id: videoId,
          source: a.source,
          url: a.url,
          title: a.title,
          score: a.score ?? null,
          fetched_at: fetchedAt,
        })),
        { onConflict: "video_id,url" },
      );
      if (upsertRes.error) {
        // upsert 失敗は致命ではない（要約 UX を阻害したくない）が、ログは残す
        console.error("related_articles_upsert_failed", upsertRes.error);
      }

      return { articles: merged, cacheHit: false };
    }),
});
