/**
 * 要約 procedure（キャッシュ統合 + 匿名認証）。
 *
 * 処理フロー:
 *   1. summaries キャッシュ Hit?
 *      Yes → そのまま返却（requests.cache_hit=true で log）
 *   2. videos + transcripts キャッシュ Hit?
 *      Yes → YouTube fetch スキップ。Claude 呼ぶ
 *      No → YouTube から meta+字幕を 1 fetch → videos / transcripts に upsert
 *   3. Claude で要約 → summaries に insert
 *   4. requests に log（cache_hit=false）
 *
 * 認証: protectedProcedure。匿名サインインで取得した user_id を requests / 将来の Free 上限判定に使う。
 *
 * 注意:
 *   - キャッシュキーは (video_id, language, prompt_version)。prompt_version は ctx 経由で取得
 *     することで、Claude SDK 依存を packages/api に持ち込まない
 *   - DB 列は snake_case、procedure 入出力は camelCase（@shari/shared schema 準拠）
 */
import {
  SUMMARY_NOT_CACHED_SLUG,
  summaryCreateInputSchema,
  summaryCreateOutputSchema,
  summaryGetInputSchema,
  summaryGetOutputSchema,
  type TranscriptSegment,
} from "@shari/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { internalError, protectedProcedure, router } from "../trpc.js";

const cachedSummarySchema = z.object({
  summary_md: z.string(),
  model: z.string(),
});

const transcriptSegmentRowSchema = z.object({
  start: z.number().nonnegative(),
  dur: z.number().nonnegative(),
  text: z.string(),
});

const cachedTranscriptSchema = z.object({
  language: z.string(),
  segments: z.array(transcriptSegmentRowSchema),
});

const cachedVideoSchema = z.object({
  title: z.string(),
  channel_name: z.string(),
});

export const summaryRouter = router({
  /**
   * 保存済み要約の読み取り専用取得（Library からの閲覧用）。
   * create と違い字幕取得・Claude 呼び出し・requests ログを一切行わない。
   *
   * prompt_version の選び方（handoff 設計）:
   *   1. 現行 prompt_version を優先
   *   2. 無ければ version 問わず最新（created_at 降順の先頭）
   *   3. それも無ければ NOT_FOUND（slug: summary_not_cached）→ mobile は「再要約する」を出す
   */
  get: protectedProcedure
    .input(summaryGetInputSchema)
    .output(summaryGetOutputSchema)
    .query(async ({ input, ctx }) => {
      const { videoId, language } = input;
      const promptVersion = ctx.services.currentPromptVersion;

      // 1. 現行 prompt_version を優先
      const currentRes = await ctx.supabase
        .from("summaries")
        .select("summary_md, model")
        .eq("video_id", videoId)
        .eq("language", language)
        .eq("prompt_version", promptVersion)
        .maybeSingle();
      if (currentRes.error) {
        throw internalError("summary_get_lookup_failed", currentRes.error);
      }
      if (currentRes.data) {
        const c = cachedSummarySchema.parse(currentRes.data);
        return { summaryMd: c.summary_md, language, model: c.model };
      }

      // 2. version 問わず最新（created_at 降順の先頭）
      const latestRes = await ctx.supabase
        .from("summaries")
        .select("summary_md, model")
        .eq("video_id", videoId)
        .eq("language", language)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestRes.error) {
        throw internalError("summary_get_lookup_failed", latestRes.error);
      }
      if (latestRes.data) {
        const c = cachedSummarySchema.parse(latestRes.data);
        return { summaryMd: c.summary_md, language, model: c.model };
      }

      // 3. 見つからない → NOT_FOUND。勝手に再生成（課金）せず mobile 側の手動切替に委ねる。
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `${SUMMARY_NOT_CACHED_SLUG}: no cached summary for ${videoId} (${language})`,
      });
    }),

  create: protectedProcedure
    .input(summaryCreateInputSchema)
    .output(summaryCreateOutputSchema)
    .mutation(async ({ input, ctx }) => {
      const { videoId, language } = input;
      const promptVersion = ctx.services.currentPromptVersion;
      const userId = ctx.user.id;

      // 1. summaries キャッシュ確認
      const cachedRes = await ctx.supabase
        .from("summaries")
        .select("summary_md, model")
        .eq("video_id", videoId)
        .eq("language", language)
        .eq("prompt_version", promptVersion)
        .maybeSingle();

      if (cachedRes.error) {
        throw internalError("summary_cache_lookup_failed", cachedRes.error);
      }

      if (cachedRes.data) {
        const cached = cachedSummarySchema.parse(cachedRes.data);
        await logRequest(ctx.supabase, userId, videoId, true);
        return {
          summaryMd: cached.summary_md,
          language,
          model: cached.model,
          cacheHit: true,
        };
      }

      // 2. videos / transcripts キャッシュ確認 → YouTube fetch を回避できるなら回避
      const [videoRow, transcriptRow] = await Promise.all([
        ctx.supabase.from("videos").select("title, channel_name").eq("id", videoId).maybeSingle(),
        ctx.supabase
          .from("transcripts")
          .select("language, segments")
          .eq("video_id", videoId)
          .maybeSingle(),
      ]);

      // DB 障害 / 権限エラーは「キャッシュ Miss」と区別する。これを Miss 扱いすると
      // YouTube fetch にフォールバック → upsert で再エラー、で原因が不可視になるため
      // ここで明示的に落とす。
      if (videoRow.error) {
        throw internalError("videos_cache_lookup_failed", videoRow.error);
      }
      if (transcriptRow.error) {
        throw internalError("transcripts_cache_lookup_failed", transcriptRow.error);
      }

      let videoTitle: string;
      let channelName: string;
      let transcriptLanguage: string;
      let transcriptSegments: TranscriptSegment[];

      const videoCached = videoRow.data !== null;
      const transcriptCached = transcriptRow.data !== null;

      if (videoCached && transcriptCached) {
        const v = cachedVideoSchema.parse(videoRow.data);
        const t = cachedTranscriptSchema.parse(transcriptRow.data);
        videoTitle = v.title;
        channelName = v.channel_name;
        transcriptLanguage = t.language;
        transcriptSegments = t.segments;
      } else {
        // メタと字幕は別 source。oEmbed と Supadata は独立に叩けるので並列化する。
        // どちらかが失敗したら mutation 全体を fail させたい (Promise.all で揃える)。
        const [meta, transcript] = await Promise.all([
          ctx.services.fetchYoutubeMetadata(videoId),
          ctx.services.fetchTranscript(videoId),
        ]);
        videoTitle = meta.videoTitle;
        channelName = meta.channelName;
        transcriptLanguage = transcript.language;
        transcriptSegments = transcript.segments;

        // videos キャッシュに upsert。channel_id / duration_sec は oEmbed では取れないので NULL。
        const videoUpsert = await ctx.supabase.from("videos").upsert({
          id: videoId,
          title: videoTitle,
          channel_name: channelName,
          channel_id: meta.channelId ?? null,
          duration_sec: meta.durationSec ?? null,
          has_transcript: true,
        });
        if (videoUpsert.error) {
          throw internalError("videos_upsert_failed", videoUpsert.error);
        }

        // transcripts キャッシュに upsert。PK は video_id 単独。
        const transcriptUpsert = await ctx.supabase.from("transcripts").upsert({
          video_id: videoId,
          language: transcriptLanguage,
          segments: transcriptSegments,
          text_length: transcript.textLength,
        });
        if (transcriptUpsert.error) {
          throw internalError("transcripts_upsert_failed", transcriptUpsert.error);
        }
      }

      // 3. Claude 呼び出し
      const transcriptText = transcriptSegments.map((s) => s.text).join(" ");
      const result = await ctx.services.summarize({
        videoId,
        videoTitle,
        channelName,
        transcriptText,
        transcriptLanguage,
        language,
      });

      // 4. summaries UPSERT。手順 1 でキャッシュ確認しても、同じ key で並行リクエスト
      //    が走ると unique 制約 (video_id, language, prompt_version) で衝突しうるため、
      //    upsert で吸収する。後勝ちで上書きされても同じ prompt_version の出力同士なので
      //    内容は実質同一（モデル温度なし + adaptive thinking で揺れは小さい）。
      const upsertRes = await ctx.supabase.from("summaries").upsert(
        {
          video_id: videoId,
          language,
          summary_md: result.summaryMd,
          model: result.model,
          prompt_version: result.promptVersion,
          input_tokens: result.inputTokens,
          output_tokens: result.outputTokens,
        },
        { onConflict: "video_id,language,prompt_version" },
      );
      if (upsertRes.error) {
        throw internalError("summaries_upsert_failed", upsertRes.error);
      }

      // 5. requests ログ
      await logRequest(ctx.supabase, userId, videoId, false);

      return {
        summaryMd: result.summaryMd,
        language,
        model: result.model,
        cacheHit: false,
      };
    }),
});

async function logRequest(
  supabase: SupabaseClient,
  userId: string,
  videoId: string,
  cacheHit: boolean,
): Promise<void> {
  // 利用ログ書き込みは「失敗しても処理本体は通す」哲学で書いてもよいが、
  // 集計の整合性を保つため fail-loud に倒す（呼び元で catch しないこと）。
  const res = await supabase.from("requests").insert({
    user_id: userId,
    video_id: videoId,
    cache_hit: cacheHit,
  });
  if (res.error) {
    throw internalError("requests_log_failed", res.error);
  }
}
