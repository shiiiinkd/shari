/**
 * Cloudflare Workers エントリポイント。
 * Hono + tRPC adapter で /trpc/* を packages/api のrouterにマウントする。
 */
import { trpcServer } from "@hono/trpc-server";
import { appRouter, type TRPCContext } from "@shari/api";
import { createClient } from "@supabase/supabase-js";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "../worker-configuration.js";
import { createLlmClient } from "./clients/llm.js";
import { buildCorsOrigin, parseEnv } from "./env.js";
import { createTranscriptProvider } from "./services/transcript.js";

const app = new Hono<{ Bindings: Env }>();

// CORS は env の ALLOWED_ORIGIN を見て決める。
// 起動時 env 検証はリクエスト初回時に走らせる（Workers は cold start 毎にモジュール初期化されるため、
// グローバルで parseEnv を呼ぶと env が undefined）。
app.use("*", async (c, next) => {
  const env = parseEnv(c.env);
  const corsMiddleware = cors({
    origin: buildCorsOrigin(env.ALLOWED_ORIGIN),
    allowMethods: ["GET", "POST", "OPTIONS"],
  });
  return corsMiddleware(c, next);
});

// ヘルスチェック
app.get("/", (c) => c.json({ ok: true, service: "shari-backend" }));

// tRPC を /trpc 配下にマウント
app.use(
  "/trpc/*",
  trpcServer({
    router: appRouter,
    onError: ({ error, path, type }) => {
      // 全 env で常時稼働する。Workers の console.error は Cloudflare ダッシュボード /
      // wrangler tail で参照する内部ログに流れるだけで、HTTP レスポンスには出ない
      // (クライアントが見るのは TRPCError.message のみ) ため、本番でも詳細を残す方が
      // 障害切り分けに有利。Sentry 等に集約したくなった時点でここを差し替える。
      console.error("[trpc] error", {
        path,
        type,
        code: error.code,
        message: error.message,
        cause: error.cause instanceof Error ? error.cause.message : error.cause,
        stack: error.stack?.split("\n").slice(0, 8).join("\n"),
      });
    },
    createContext: async (_opts, c): Promise<TRPCContext> => {
      const env = parseEnv(c.env);

      // service_role キーで作成 → RLS をバイパス。isolate 越し共有 NG のためリクエスト毎に作る。
      const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

      // Authorization: Bearer <jwt> から user を解決。無効/未指定なら undefined のまま。
      // Supabase Auth 側の一時障害・ネットワーク不調を「未ログイン」と握り潰すと
      // protectedProcedure が UNAUTHORIZED を返し、クライアントからは「未ログイン」に
      // しか見えず原因切り分けが困難になる。error はログに残して観測可能にする。
      let user: { id: string } | undefined;
      const authHeader = c.req.header("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.slice("Bearer ".length);
        const { data, error } = await supabase.auth.getUser(token);
        if (error) {
          console.warn("auth_get_user_failed", {
            message: error.message,
            status: error.status,
          });
        } else if (data.user) {
          user = { id: data.user.id };
        }
      }

      // 外部サービスを context に注入。重い SDK / 切替可能 provider を直接 packages/api に
      // 持ち込まないため、backend 側で env を bind したクロージャだけを渡す。
      // LLM (Claude / Gemini) と Transcript provider (Supadata / 将来候補) はそれぞれ
      // factory で env から選んでいる。
      const llm = createLlmClient(env);
      const transcript = createTranscriptProvider(env);
      const services = {
        summarize: (request: Parameters<typeof llm.summarize>[0]) => llm.summarize(request),
        currentPromptVersion: llm.promptVersion,
        fetchTranscript: (videoId: string) => transcript.fetch(videoId),
      };

      return { env, supabase, user, services };
    },
  }),
);

export default app;
