/**
 * ライブラリ（要約履歴）procedure。
 *
 * 履歴は利用ログ `requests` から派生する read-model。DB view `user_summary_history`
 * （video_id で重複排除し最新順）を介して取得する。将来の保存 / お気に入りもこの router に集約する。
 *
 * 認証 / RLS 注意:
 *   - protectedProcedure（匿名サインイン済み user_id 必須）
 *   - ctx.supabase は service_role（RLS バイパス）。view 側 RLS には頼れないため、
 *     **必ず .eq("user_id", ctx.user.id) で明示的に絞る**。
 */
import { libraryHistoryInputSchema, libraryHistoryOutputSchema } from "@shari/shared";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../trpc.js";

/** view から取得する 1 行（snake_case）。 */
const historyRowSchema = z.object({
  video_id: z.string(),
  title: z.string(),
  channel_name: z.string(),
  last_viewed_at: z.string(),
});

export const libraryRouter = router({
  /**
   * 要約履歴の一覧（最終閲覧の新しい順）。range（offset/limit）ページング。
   * limit+1 件を取得して次ページの有無（nextOffset）を判定する。
   */
  history: protectedProcedure
    .input(libraryHistoryInputSchema)
    .output(libraryHistoryOutputSchema)
    .query(async ({ input, ctx }) => {
      const { limit } = input;
      // cursor は取得開始 offset（実体は range offset）。null/未指定は先頭。
      const offset = input.cursor ?? 0;
      const userId = ctx.user.id;

      // PostgREST の .range(from, to) は両端 inclusive。limit+1 件を取り hasMore を判定する。
      // last_viewed_at の同値ズレでページ跨ぎが乱れないよう video_id を副ソートキーにする。
      const res = await ctx.supabase
        .from("user_summary_history")
        .select("video_id, title, channel_name, last_viewed_at")
        .eq("user_id", userId)
        .order("last_viewed_at", { ascending: false })
        .order("video_id", { ascending: true })
        .range(offset, offset + limit);

      if (res.error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `library_history_failed: ${res.error.message}`,
        });
      }

      const rows = z.array(historyRowSchema).parse(res.data ?? []);
      const hasMore = rows.length > limit;
      const page = hasMore ? rows.slice(0, limit) : rows;

      return {
        items: page.map((r) => ({
          videoId: r.video_id,
          title: r.title,
          channelName: r.channel_name,
          lastViewedAt: r.last_viewed_at,
        })),
        nextCursor: hasMore ? offset + limit : null,
      };
    }),
});
