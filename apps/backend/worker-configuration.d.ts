/**
 * Cloudflare Workers の環境バインディング型。
 * wrangler.toml の vars / secrets / bindings を追加したらここに反映する。
 * シークレットを足すときの完全手順は /setup-secret skill を参照。
 */
export interface Env {
  // --- AI ---
  ANTHROPIC_API_KEY: string;

  // --- Supabase ---
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  /** サーバ専用。mobile に絶対渡さない。 */
  SUPABASE_SERVICE_ROLE_KEY: string;

  // --- 外部API（任意） ---
  QIITA_TOKEN?: string;
}
