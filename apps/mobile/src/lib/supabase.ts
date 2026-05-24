/**
 * Mobile 用 Supabase クライアント。
 * 用途は基本的に Auth のみ:
 *   - 初回起動時の匿名サインイン
 *   - 以降のリクエストで Bearer JWT を取得 → tRPC ヘッダに乗せる
 * DB アクセスは tRPC backend 経由で行うため、ここから .from(...) を直接叩かない。
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY が未設定です。apps/mobile/.env を確認してください。",
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/**
 * 既存セッションがあれば返し、無ければ匿名サインインして新規セッションを作る。
 * App の最初のレンダリング前に必ず通す（tRPC ヘッダで access_token が必要なため）。
 */
export async function ensureSession(): Promise<string> {
  // AsyncStorage 読み取り失敗等で getSession 自身が error を返すケースを握り潰さない。
  // ここで握り潰すと「永遠に signInAnonymously に流れる」「splash が解除されない」
  // 等の症状が出て原因切り分けが困難になる。
  const { data: sessionData, error: getSessionError } = await supabase.auth.getSession();
  if (getSessionError) {
    throw new Error(`セッション取得に失敗しました: ${getSessionError.message}`);
  }
  if (sessionData.session) {
    return sessionData.session.access_token;
  }

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.session) {
    throw new Error(`匿名サインインに失敗しました: ${error?.message ?? "session が空"}`);
  }
  return data.session.access_token;
}
