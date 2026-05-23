/**
 * tRPC のコア初期化。
 * Context はbackend側（apps/backend）で生成されたものがここに渡る。
 * このパッケージは router の「型定義」を提供するだけで、ランタイム依存は最小に保つ。
 */
import { initTRPC } from "@trpc/server";

/**
 * Record互換にするため type alias で定義（interface だと @hono/trpc-server の
 * Record<string, unknown> 制約に空オブジェクトが入らない）。
 * 認証ユーザー情報や Supabase クライアントを後でここに足す:
 *   user?: { id: string };
 *   supabase?: SupabaseClient;
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type TRPCContext = {};

const t = initTRPC.context<TRPCContext>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
