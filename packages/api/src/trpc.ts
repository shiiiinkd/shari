/**
 * tRPC のコア初期化。
 * Context は backend 側（apps/backend）で生成されたものがここに渡る。
 * このパッケージは router の「型定義」を提供するだけで、ランタイム依存は最小に保つ。
 */
import type {
  RelatedArticle,
  SummaryRequest,
  SummaryResult,
  TranscriptOutput,
} from "@shari/shared";
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

/**
 * backend 側の重い依存（Anthropic SDK 等）に packages/api が直接依存しないよう、
 * 注入可能な service として contract だけ宣言する。実装は apps/backend で組み立て、
 * createContext から渡す。
 */
export interface BackendServices {
  /** 字幕 + 動画メタ + 言語指定 を受けて LLM (Claude / 将来 Gemini) に要約させる。 */
  summarize: (request: SummaryRequest) => Promise<SummaryResult>;
  /**
   * 現在の (LLM + prompt template) を表すバージョン文字列。
   * summaries テーブルの cache key として使うため、LLM 呼び出し前に procedure 側で参照する。
   * LLM 切替・プロンプト書き換えで値が変わり、自動的に再生成される。
   */
  currentPromptVersion: string;
  /**
   * videoId を受けて字幕を取得する。
   * MVP は Supadata 経由。実装は apps/backend/src/services/transcript.ts。
   */
  fetchTranscript: (videoId: string) => Promise<TranscriptOutput>;
  /**
   * videoId から動画メタデータ（タイトル・チャンネル名）を取得する。
   * YouTube oEmbed 経由。実装は apps/backend/src/services/youtube.ts。
   */
  fetchYoutubeMetadata: (videoId: string) => Promise<{
    videoTitle: string;
    channelName: string;
    channelId?: string;
    durationSec?: number;
  }>;
  /**
   * タイトルから関連記事を検索・スコアソート・OGP enrich して返す。
   * 実装は apps/backend/src/services/articles.ts。
   */
  fetchRelatedArticles: (
    title: string,
    options: { qiitaToken?: string },
  ) => Promise<RelatedArticle[]>;
}

export type TRPCContext = {
  env: ContextEnv;
  /** service_role キーで作成された Supabase クライアント（RLS をバイパスする）。 */
  supabase: SupabaseClient;
  /** Authorization: Bearer <jwt> から解決された匿名/通常ユーザー。未認証なら undefined。 */
  user?: { id: string };
  services: BackendServices;
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
