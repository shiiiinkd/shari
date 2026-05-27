/**
 * Cloudflare Workers の環境バインディング型。
 * wrangler.toml の vars / secrets / bindings を追加したらここに反映する。
 * シークレットを足すときの完全手順は /setup-secret skill を参照。
 *
 * 注: ここで宣言した型は「存在することを保証しない」。実体は wrangler secret や
 * .dev.vars に依存するので、起動時の検証は src/env.ts の envSchema で行う。
 * 型上は optional にせず必須として宣言し、未投入なら fail-fast する設計。
 */
export interface Env {
  // --- AI ---
  ANTHROPIC_API_KEY: string;
  /** "claude" / "gemini"。未設定は claude。Phase 2 で Gemini を追加予定。 */
  LLM_PROVIDER?: string;

  // --- Supabase ---
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  /** サーバ専用。mobile に絶対渡さない。 */
  SUPABASE_SERVICE_ROLE_KEY: string;

  // --- 外部API（任意） ---
  QIITA_TOKEN?: string;

  // --- CORS / 動作モード ---
  /** カンマ区切りで複数オリジン指定可。`*` で全許可（dev のみ）。 */
  ALLOWED_ORIGIN: string;
}
