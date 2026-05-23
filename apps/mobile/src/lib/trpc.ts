/**
 * tRPC client（mobile側）。
 * packages/api の AppRouter 型をimportして型安全に呼び出す。
 *
 * backend URL は app.config.ts の extra 経由で取得する。
 * 値の元は EXPO_PUBLIC_TRPC_URL。実機・Android Emulator では PC の LAN IP に変える。
 * 詳しい開発機別の切替は /expo-dev skill を参照。
 */
import type { AppRouter } from "@shari/api";
import { createTRPCReact } from "@trpc/react-query";
import Constants from "expo-constants";

export const trpc = createTRPCReact<AppRouter>();

const extra = Constants.expoConfig?.extra as { trpcUrl?: string } | undefined;

if (!extra?.trpcUrl) {
  // app.config.ts で必ず default を入れているのでここに来るのは config 取得失敗時のみ。
  // 起動を止めて気づけるようにする。
  throw new Error(
    "EXPO_PUBLIC_TRPC_URL が解決できませんでした。app.config.ts と .env を確認してください。",
  );
}

export const TRPC_URL: string = extra.trpcUrl;
