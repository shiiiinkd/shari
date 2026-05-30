/**
 * ライブラリ（要約履歴）の schema。
 * tRPC procedure `library.history` の入出力。
 *
 * 履歴は利用ログ `requests`（docs/data-model.md §3.6）から派生する read-model。
 * DB view `user_summary_history`（video_id で重複排除し最新順）を介して取得する。
 * 「履歴から削除」を将来入れる場合も requests 行は消さない（Free 上限集計が壊れるため）。
 */
import { z } from "zod";
import { videoIdSchema } from "./youtube.js";

/** ライブラリ履歴一覧の 1 件。要約済み動画の最小情報。 */
export const libraryHistoryItemSchema = z.object({
  videoId: videoIdSchema,
  title: z.string().min(1),
  channelName: z.string().min(1),
  /**
   * その動画を最後に開いた時刻（requests.created_at の最大）。
   * PostgREST 由来の ISO8601 timestamptz 文字列。表示専用のため形式は厳密検証しない。
   * サムネは videoId から `https://img.youtube.com/vi/{videoId}/hqdefault.jpg` で導出するため列に持たない。
   */
  lastViewedAt: z.string(),
});
export type LibraryHistoryItem = z.infer<typeof libraryHistoryItemSchema>;

/**
 * ライブラリ履歴一覧の入力。range（offset/limit）ページング。
 * `cursor` は取得開始 offset（0 起点）。null/未指定は先頭ページ。
 * tRPC useInfiniteQuery と素直に噛み合うよう field 名を cursor にしている（実体は offset）。
 */
export const libraryHistoryInputSchema = z.object({
  cursor: z.number().int().nonnegative().nullish(),
  /** 1 ページ件数。 */
  limit: z.number().int().positive().max(50).default(20),
});
export type LibraryHistoryInput = z.infer<typeof libraryHistoryInputSchema>;

/** ライブラリ履歴一覧の出力。nextCursor が null なら最終ページ。 */
export const libraryHistoryOutputSchema = z.object({
  items: z.array(libraryHistoryItemSchema),
  /** 次ページの開始 offset。これ以上無ければ null（無限スクロールの停止条件）。 */
  nextCursor: z.number().int().nonnegative().nullable(),
});
export type LibraryHistoryOutput = z.infer<typeof libraryHistoryOutputSchema>;
