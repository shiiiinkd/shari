/**
 * Cloudflare Workers の環境バインディング型。
 * wrangler.toml で vars / secrets / bindings を追加したらここに反映する。
 */
export interface Env {
  // 例:
  // ANTHROPIC_API_KEY: string;
  // SUPABASE_URL: string;
  // SUPABASE_ANON_KEY: string;
}
