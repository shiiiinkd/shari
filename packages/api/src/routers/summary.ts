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
  summaryCreateInputSchema,
  summaryCreateOutputSchema,
  type TranscriptSegment,
} from "@shari/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { fetchYoutubeContent } from "../services/youtube.js";
import { protectedProcedure, router } from "../trpc.js";

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
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `summary_cache_lookup_failed: ${cachedRes.error.message}`,
        });
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

      let videoTitle: string;
      let channelName: string;
      let transcriptLanguage: string;
      let transcriptSegments: TranscriptSegment[];

      const videoCached = !videoRow.error && videoRow.data !== null;
      const transcriptCached = !transcriptRow.error && transcriptRow.data !== null;

      if (videoCached && transcriptCached) {
        const v = cachedVideoSchema.parse(videoRow.data);
        const t = cachedTranscriptSchema.parse(transcriptRow.data);
        videoTitle = v.title;
        channelName = v.channel_name;
        transcriptLanguage = t.language;
        transcriptSegments = t.segments;
      } else {
        const content = await fetchYoutubeContent(videoId);
        videoTitle = content.meta.videoTitle;
        channelName = content.meta.channelName;
        transcriptLanguage = content.transcript.language;
        transcriptSegments = content.transcript.segments;

        // videos キャッシュに upsert。channel_id / duration_sec は取れたら埋める。
        const videoUpsert = await ctx.supabase.from("videos").upsert({
          id: videoId,
          title: videoTitle,
          channel_name: channelName,
          channel_id: content.meta.channelId ?? null,
          duration_sec: content.meta.durationSec ?? null,
          has_transcript: true,
        });
        if (videoUpsert.error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `videos_upsert_failed: ${videoUpsert.error.message}`,
          });
        }

        // transcripts キャッシュに upsert。PK は video_id 単独。
        const transcriptUpsert = await ctx.supabase.from("transcripts").upsert({
          video_id: videoId,
          language: transcriptLanguage,
          segments: transcriptSegments,
          text_length: content.transcript.textLength,
        });
        if (transcriptUpsert.error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `transcripts_upsert_failed: ${transcriptUpsert.error.message}`,
          });
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

      // 4. summaries INSERT。unique 制約 (video_id, language, prompt_version) は
      //    ここに来ている時点で空であることを保証している（手順 1 で確認済み）。
      const insertRes = await ctx.supabase.from("summaries").insert({
        video_id: videoId,
        language,
        summary_md: result.summaryMd,
        model: result.model,
        prompt_version: result.promptVersion,
        input_tokens: result.inputTokens,
        output_tokens: result.outputTokens,
      });
      if (insertRes.error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `summaries_insert_failed: ${insertRes.error.message}`,
        });
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
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `requests_log_failed: ${res.error.message}`,
    });
  }
}
