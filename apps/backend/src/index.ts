/**
 * Cloudflare Workers エントリポイント。
 * Hono + tRPC adapter で /trpc/* を packages/api のrouterにマウントする。
 */
import { trpcServer } from "@hono/trpc-server";
import { appRouter, type TRPCContext } from "@shari/api";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "../worker-configuration.js";

const app = new Hono<{ Bindings: Env }>();

// モバイルアプリ（Expo Dev Server）からのアクセスを許可
app.use(
  "*",
  cors({
    origin: "*", // 本番では https://shari.app 等に絞る
    allowMethods: ["GET", "POST", "OPTIONS"],
  }),
);

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
