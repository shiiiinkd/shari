/**
 * 要約 procedure（キャッシュ統合 + 匿名認証）。
 *
 * 処理フロー:
 *   1. summaries キャッシュ Hit?
 *      Yes → そのまま返却（requests.cache_hit=true で log）
 *   2. videos + transcripts キャッシュ Hit?
 *      Yes → YouTube fetch スキップ
 *      No  → YouTube から meta+字幕を 1 fetch → videos / transcripts に upsert
 *   3. **翻訳ステップ**（v2-translate-then-summarize 以降）:
 *      字幕言語 == 要約出力言語なら skip。
 *      それ以外は translations キャッシュ確認 → 取得 or 生成 → upsert。
 *   4. Claude で要約（入力は翻訳済みテキスト or 元字幕）
 *   5. summaries に upsert
 *   6. requests に log（cache_hit=false）
 *
 * 認証: protectedProcedure。匿名サインインで取得した user_id を requests / 将来の Free 上限判定に使う。
 *
 * 注意:
 *   - キャッシュキーは (video_id, language, prompt_version)。prompt_version は ctx 経由で取得
 *     することで、Claude SDK 依存を packages/api に持ち込まない
 *   - translations の PK は (video_id, source_language, target_language)。prompt_version は
 *     列としては保持するが lookup 条件には入れない（同じ key で再翻訳しても上書きする方針）
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

const cachedTranslationSchema = z.object({
  translated_text: z.string(),
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

      // DB 障害 / 権限エラーは「キャッシュ Miss」と区別する。これを Miss 扱いすると
      // YouTube fetch にフォールバック → upsert で再エラー、で原因が不可視になるため
      // ここで明示的に落とす。
      if (videoRow.error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `videos_cache_lookup_failed: ${videoRow.error.message}`,
        });
      }
      if (transcriptRow.error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `transcripts_cache_lookup_failed: ${transcriptRow.error.message}`,
        });
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

      // 3. 翻訳ステップ（字幕言語 != 出力言語 のときのみ）
      //    要約は翻訳済みテキストで行うほうが日本語品質が安定するため、
      //    Claude 要約呼び出しの直前に挟む。
      //    PK は (video_id, source_language, target_language)。同じ key の再翻訳は upsert で
      //    上書きする方針（prompt_version は記録目的で残すが lookup 条件には入れない）。
      const rawTranscriptText = transcriptSegments.map((s) => s.text).join(" ");
      let transcriptText = rawTranscriptText;
      let summarizeInputLanguage = transcriptLanguage;

      if (transcriptLanguage !== language) {
        const translationLookup = await ctx.supabase
          .from("translations")
          .select("translated_text")
          .eq("video_id", videoId)
          .eq("source_language", transcriptLanguage)
          .eq("target_language", language)
          .maybeSingle();

        if (translationLookup.error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `translations_cache_lookup_failed: ${translationLookup.error.message}`,
          });
        }

        if (translationLookup.data) {
          transcriptText = cachedTranslationSchema.parse(translationLookup.data).translated_text;
        } else {
          const translation = await ctx.services.translate({
            videoId,
            videoTitle,
            channelName,
            sourceText: rawTranscriptText,
            sourceLanguage: transcriptLanguage,
            targetLanguage: language,
          });

          const translationUpsert = await ctx.supabase.from("translations").upsert(
            {
              video_id: videoId,
              source_language: transcriptLanguage,
              target_language: language,
              translated_text: translation.translatedText,
              model: translation.model,
              prompt_version: translation.promptVersion,
              input_tokens: translation.inputTokens,
              output_tokens: translation.outputTokens,
            },
            { onConflict: "video_id,source_language,target_language" },
          );
          if (translationUpsert.error) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: `translations_upsert_failed: ${translationUpsert.error.message}`,
            });
          }

          transcriptText = translation.translatedText;
        }

        // 翻訳済みテキストの「言語」は出力言語と一致する。summarize に正しく伝える。
        summarizeInputLanguage = language;
      }

      // 4. Claude 呼び出し（入力は翻訳済み or 元字幕）
      const result = await ctx.services.summarize({
        videoId,
        videoTitle,
        channelName,
        transcriptText,
        transcriptLanguage: summarizeInputLanguage,
        language,
      });

      // 5. summaries UPSERT。手順 1 でキャッシュ確認しても、同じ key で並行リクエスト
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
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `summaries_upsert_failed: ${upsertRes.error.message}`,
        });
      }

      // 6. requests ログ
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
