/**
 * 字幕（transcript）取得の output schema。
 * input は @shari/shared/schemas/youtube の youtubeUrlSchema を使い回す。
 * data-model.md の transcripts テーブル（segments jsonb）と同形にしてキャッシュ書き込みを単純化する。
 */
import { z } from "zod";

export const transcriptSegmentSchema = z.object({
  /** 開始秒（小数）。 */
  start: z.number().nonnegative(),
  /** 表示秒数（小数）。 */
  dur: z.number().nonnegative(),
  text: z.string(),
});

export const transcriptOutputSchema = z.object({
  /** YouTube 側から取れた字幕の言語コード（例: 'ja', 'en'）。 */
  language: z.string().min(1),
  segments: z.array(transcriptSegmentSchema),
  /** segments の text を全部繋いだ長さ。要約コスト見積もり用。 */
  textLength: z.number().int().nonnegative(),
});

export type TranscriptSegment = z.infer<typeof transcriptSegmentSchema>;
export type TranscriptOutput = z.infer<typeof transcriptOutputSchema>;
