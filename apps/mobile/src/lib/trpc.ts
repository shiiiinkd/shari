/**
 * tRPC client（mobile側）。
 * packages/api の AppRouter 型をimportして型安全に呼び出す。
 *
 * backend URL の解決順（resolveTrpcUrl）:
 *   1. EXPO_PUBLIC_TRPC_URL（app.config.ts の extra 経由）が明示されていればそれ。
 *      出先のトンネル接続URL・本番URL はここで指定する。
 *   2. Web は同一ホストの localhost（SSH ポートフォワードで到達）。
 *   3. 実機 / Simulator は Metro 接続ホスト(LAN IP)から導出して :8787 を叩く。
 *      → Mac とスマホが同一 WiFi なら .env を触らず自動で繋がる
 *        （backend は `--ip 0.0.0.0` で起動＝`pnpm dev`）。
 * 詳しい開発機別の切替・トンネル手順は /expo-dev skill を参照。
 */
import type { AppRouter } from "@shari/api";
import { createTRPCReact } from "@trpc/react-query";
import Constants from "expo-constants";
import { Platform } from "react-native";

export const trpc = createTRPCReact<AppRouter>();

/**
 * Metro / Expo Go の dev サーバホスト（"192.168.0.16:8081" 形式）からホスト部を取り出す。
 * dev ホストは SDK / 接続形態で入る場所が違うため、複数フィールドを順に見る。
 */
function resolveDevHost(): string | undefined {
  const expoGo = Constants.expoGoConfig as { debuggerHost?: string } | null | undefined;
  const raw = Constants.expoConfig?.hostUri ?? expoGo?.debuggerHost;
  // "host:port" or "user@host:port" のホスト部のみ
  return raw?.split("@").pop()?.split(":")[0];
}

function resolveTrpcUrl(): string {
  // 1. 明示指定が最優先（出先のトンネルURL / 本番URL）。
  //    Expo の config 解決で値が object 化することがあるため、非空文字列のみ採用する。
  const extra = Constants.expoConfig?.extra as { trpcUrl?: unknown } | undefined;
  const explicit = extra?.trpcUrl;
  if (typeof explicit === "string" && explicit.length > 0) return explicit;

  // 2. 実機 / Simulator → Metro 接続ホスト(LAN IP)から導出
  if (Platform.OS !== "web") {
    const host = resolveDevHost();
    if (host) return `http://${host}:8787/trpc`;
  }

  // 3. Web、または dev ホストが取れない場合は同一ホストの localhost
  return "http://localhost:8787/trpc";
}

export const TRPC_URL: string = resolveTrpcUrl();

if (__DEV__) {
  // 実機で接続先がズレたとき用の診断ログ（Metro ターミナルに出力される）
  const expoGo = Constants.expoGoConfig as { debuggerHost?: string } | null | undefined;
  console.warn(
    `[trpc] TRPC_URL=${TRPC_URL} platform=${Platform.OS} ` +
      `hostUri=${Constants.expoConfig?.hostUri ?? "∅"} ` +
      `debuggerHost=${expoGo?.debuggerHost ?? "∅"}`,
  );
}
