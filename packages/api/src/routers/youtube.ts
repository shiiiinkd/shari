/**
 * YouTube 関連 procedure。
 * MVP 段階では字幕取得のみ。動画メタデータ取得（タイトル・チャンネル名）は
 * summary パイプライン内で必要になったタイミングで追加する。
 */
import { transcriptOutputSchema, youtubeUrlSchema } from "@shari/shared";
import { z } from "zod";
import { publicProcedure, router } from "../trpc.js";
import { fetchYoutubeTranscript } from "../services/youtube.js";

export const youtubeRouter = router({
  /**
   * YouTube URL を受け取り、字幕（transcript）を取得して返す。
   * 入力は URL を渡すが、Zod 側で videoId に transform される。
   * 副作用: YouTube 公開ページ + 字幕 XML への fetch のみ（DB は触らない）。
   */
  fetchTranscript: publicProcedure
    .input(z.object({ url: youtubeUrlSchema }))
    .output(transcriptOutputSchema)
    .query(async ({ input }) => {
      // input.url は youtubeUrlSchema の transform 後で videoId 文字列になっている。
      return fetchYoutubeTranscript(input.url);
    }),
});
