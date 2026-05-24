/**
 * Claude 要約機能の入出力 Zod schema。
 * - backend: summarizeTranscript() の入出力検証
 * - api (tRPC procedure): 公開IF の入出力検証
 * - mobile: 受信レスポンスの型として参照
 *
 * 対応する DB 列の設計根拠は docs/data-model.md §3.4 (summaries テーブル) 参照。
 */
import { z } from "zod";
import { videoIdSchema } from "./youtube.js";

/** 要約の出力言語。MVP では 'ja' のみ実運用想定だが、将来 en 対応の余地を残す。 */
export const summaryLanguageSchema = z.enum(["ja", "en"]);
export type SummaryLanguage = z.infer<typeof summaryLanguageSchema>;

/** Claude に渡す要約リクエスト。 */
export const summaryRequestSchema = z.object({
  videoId: videoIdSchema,
  videoTitle: z.string().min(1).max(500),
  channelName: z.string().min(1).max(200),
  /** 字幕本文。短すぎるものは要約価値が薄いので下限を設ける。 */
  transcriptText: z.string().min(50),
  /** 字幕の元言語（例: 'en', 'ja'）。出力言語ではなく入力字幕の言語。 */
  transcriptLanguage: z.string().min(2).max(10),
  /** 要約の出力言語。 */
  language: summaryLanguageSchema.default("ja"),
});
export type SummaryRequest = z.infer<typeof summaryRequestSchema>;

/**
 * tRPC procedure `summary.create` の入力。
 * mobile が叩く外向き IF。内部の Claude SDK 呼び出し用 summaryRequestSchema とは別レイヤ。
 */
export const summaryCreateInputSchema = z.object({
  videoId: videoIdSchema,
  /** 出力言語。MVP では実質 'ja' のみ。 */
  language: summaryLanguageSchema.default("ja"),
});
export type SummaryCreateInput = z.infer<typeof summaryCreateInputSchema>;

/**
 * tRPC procedure `summary.create` の出力。
 * mobile に返す最小情報。トークン数等の内部指標は含めない。
 */
export const summaryCreateOutputSchema = z.object({
  summaryMd: z.string().min(1),
  language: summaryLanguageSchema,
  model: z.string().min(1),
  /** Supabase キャッシュから返したか（true）/ Claude を呼んだか（false）。 */
  cacheHit: z.boolean(),
});
export type SummaryCreateOutput = z.infer<typeof summaryCreateOutputSchema>;

/** Claude 要約結果。summaries テーブルの列構造に揃える。 */
export const summaryResultSchema = z.object({
  /** Markdown 形式の要約本文。 */
  summaryMd: z.string().min(1),
  /** 使用した Claude モデル ID。 */
  model: z.string().min(1),
  /**
   * プロンプトテンプレート + モデルを表すバージョン文字列。
   * テンプレ書き換え or モデル切替で値が変わり、DB の unique 制約
   * (video_id, language, prompt_version) により自動的に再生成される。
   */
  promptVersion: z.string().min(1),
  /** 入力トークン総数（uncached + cache_read + cache_create の合計）。 */
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
});
export type SummaryResult = z.infer<typeof summaryResultSchema>;
