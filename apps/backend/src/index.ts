/**
 * Cloudflare Workers エントリポイント。
 * Hono + tRPC adapter で /trpc/* を packages/api のrouterにマウントする。
 */
import { trpcServer } from "@hono/trpc-server";
import { appRouter, type TRPCContext } from "@shari/api";
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
    createContext: (_opts, _c): TRPCContext => {
      // 認証・Supabaseクライアントなどを後でここに足す
      return {};
    },
  }),
);

export default app;
