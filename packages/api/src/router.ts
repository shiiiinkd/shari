/**
 * Shari の tRPC ルートrouter。
 * mobile からは型として参照され、backend では実装本体としてマウントされる。
 * 機能を増やすときはここに sub-router を追加していく（summarize, articles, auth など）。
 */
import { z } from "zod";
import { publicProcedure, router } from "./trpc.js";

export const appRouter = router({
  /** 疎通確認用。最初のend-to-endテストで使う。 */
  hello: publicProcedure.input(z.object({ name: z.string().min(1).max(50) })).query(({ input }) => {
    return {
      message: `こんにちは、${input.name}さん。Shariへようこそ🍣`,
      timestamp: new Date().toISOString(),
    };
  }),
});

export type AppRouter = typeof appRouter;
