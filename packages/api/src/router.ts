/**
 * Shari の tRPC ルートrouter。
 * mobile からは型として参照され、backend では実装本体としてマウントされる。
 * 機能を増やすときはここに sub-router を追加していく（summarize, articles, auth など）。
 * 新 procedure の追加手順は /add-trpc-procedure skill 参照。
 */
import { helloInputSchema } from "@shari/shared";
import { articlesRouter } from "./routers/articles.js";
import { libraryRouter } from "./routers/library.js";
import { summaryRouter } from "./routers/summary.js";
import { publicProcedure, router } from "./trpc.js";

export const appRouter = router({
  /** 疎通確認用。最初のend-to-endテストで使う。 */
  hello: publicProcedure.input(helloInputSchema).query(({ input }) => {
    return {
      message: `こんにちは、${input.name}さん。Shariへようこそ🍣`,
      timestamp: new Date().toISOString(),
    };
  }),

  /** 要約 procedure（Claude / 将来 Gemini への切替可能）。 */
  summary: summaryRouter,

  /** 関連技術記事（Qiita / Zenn）取得 procedure。 */
  articles: articlesRouter,

  /** ライブラリ（要約履歴）procedure。 */
  library: libraryRouter,
});

export type AppRouter = typeof appRouter;
