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
import { buildCorsOrigin, parseEnv } from "./env.js";

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
    createContext: async (_opts, c): Promise<TRPCContext> => {
      const env = parseEnv(c.env);

      // service_role キーで作成 → RLS をバイパス。isolate 越し共有 NG のためリクエスト毎に作る。
      const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

      // Authorization: Bearer <jwt> から user を解決。無効/未指定なら undefined のまま。
      let user: { id: string } | undefined;
      const authHeader = c.req.header("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.slice("Bearer ".length);
        const { data, error } = await supabase.auth.getUser(token);
        if (!error && data.user) {
          user = { id: data.user.id };
        }
      }

      return { env, supabase, user };
    },
  }),
);

export default app;
