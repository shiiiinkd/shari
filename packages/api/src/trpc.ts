/**
 * tRPC のコア初期化。
 * Context は backend 側（apps/backend）で生成されたものがここに渡る。
 * このパッケージは router の「型定義」を提供するだけで、ランタイム依存は最小に保つ。
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { TRPCError, initTRPC } from "@trpc/server";

/**
 * procedure が必要とする env キーの subset。
 * 完全な ValidatedEnv は apps/backend/src/env.ts にあるが、ここで再宣言すると
 * packages/api → apps/backend の逆依存になるので、構造的に互換な型をここで定義する。
 * apps/backend 側で ValidatedEnv を流し込めば structural typing で適合する。
 */
export interface ContextEnv {
  ANTHROPIC_API_KEY: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  QIITA_TOKEN?: string;
  ALLOWED_ORIGIN: string;
}

export type TRPCContext = {
  env: ContextEnv;
  /** service_role キーで作成された Supabase クライアント（RLS をバイパスする）。 */
  supabase: SupabaseClient;
  /** Authorization: Bearer <jwt> から解決された匿名/通常ユーザー。未認証なら undefined。 */
  user?: { id: string };
};

const t = initTRPC.context<TRPCContext>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

/**
 * 認証必須 procedure。ctx.user が無ければ UNAUTHORIZED を返す。
 * 通過後の ctx.user は non-nullable に narrowing される。
 */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: { ...ctx, user: ctx.user },
  });
});
