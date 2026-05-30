/**
 * Expo の dynamic config。
 * EXPO_PUBLIC_TRPC_URL が指定されていれば extra.trpcUrl に詰めて override にする
 * （出先のトンネルURL / 本番URL 用）。未指定なら extra に入れない（key 自体を省く）。
 * ※ null を入れると Expo の config 解決で `{}` に化けて誤判定するため必ず省略する。
 * URL の解決は src/lib/trpc.ts の resolveTrpcUrl()（Web=localhost / 実機=Metro hostUri から LAN IP 自動導出）に委ねる。
 * 詳しい開発機別設定・トンネル手順は /expo-dev skill を参照。
 */
import type { ExpoConfig } from "expo/config";

const trpcUrl = process.env.EXPO_PUBLIC_TRPC_URL;

const config: ExpoConfig = {
  name: "mobile",
  slug: "mobile",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  runtimeVersion: {
    policy: "sdkVersion",
  },
  ios: {
    supportsTablet: true,
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#E6F4FE",
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  extra: trpcUrl ? { trpcUrl } : {},
};

export default config;
