/**
 * Claude 翻訳機能の入出力 Zod schema。
 *
 * 用途:
 * - backend: translateTranscript() の入出力検証
 * - api: ctx.services.translate の型 contract（procedure 外向きには公開しない＝内部 IF）
 *
 * 対応する DB 列の設計根拠は docs/data-model.md §3.3.1 (translations テーブル) 参照。
 *
 * summary.create の外向き IF とは独立した内部 schema。procedure 入出力には混ぜない。
 */
import { z } from "zod";
import { videoIdSchema } from "./youtube.js";

/** Claude に渡す翻訳リクエスト。 */
export const translateRequestSchema = z.object({
  videoId: videoIdSchema,
  videoTitle: z.string().min(1).max(500),
  channelName: z.string().min(1).max(200),
  /** 翻訳対象の本文（transcript の segments を連結したもの）。短すぎる翻訳は意味が薄いので下限を設ける。 */
  sourceText: z.string().min(50),
  /** 元言語（例: 'en'）。 */
  sourceLanguage: z.string().min(2).max(10),
  /** 翻訳先言語（MVP は 'ja' のみ実運用想定）。 */
  targetLanguage: z.string().min(2).max(10),
});
export type TranslateRequest = z.infer<typeof translateRequestSchema>;

/**
 * Claude 翻訳結果。translations テーブルの列構造に揃える。
 * summaries.promptVersion と同じく (template, model) 由来のキャッシュキー文字列を返す。
 */
export const translateResultSchema = z.object({
  /** 翻訳本文（プレーンテキスト。Markdown 整形は要約側に任せる）。 */
  translatedText: z.string().min(1),
  /** 元言語（リクエストをエコーバック。translations テーブルへの書き込みで PK 列として使う）。 */
  sourceLanguage: z.string().min(2).max(10),
  /** 翻訳先言語（同上）。 */
  targetLanguage: z.string().min(2).max(10),
  /** 使用した Claude モデル ID。 */
  model: z.string().min(1),
  /** 翻訳プロンプトテンプレ + モデルを表すバージョン。translations の監査メタ列。 */
  promptVersion: z.string().min(1),
  /** 入力トークン総数（uncached + cache_read + cache_create の合計）。 */
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
});
export type TranslateResult = z.infer<typeof translateResultSchema>;
