/**
 * Expo の dynamic config。
 * EXPO_PUBLIC_* で渡された値を extra に詰めて、Constants.expoConfig.extra 経由で読む。
 * 実機・Android Emulator・本番で backend URL を切り替えるためのもの。
 * 詳しい開発機別設定は /expo-dev skill を参照。
 */
import type { ExpoConfig } from "expo/config";

const trpcUrl = process.env.EXPO_PUBLIC_TRPC_URL ?? "http://localhost:8787/trpc";

const config: ExpoConfig = {
  name: "mobile",
  slug: "mobile",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  // OS 標準共有メニュー（YouTube → shari）から起動するための custom URL scheme。
  // iOS は MVP で本 scheme + "他アプリで開く" 経由。Universal Links は Phase 2 以降。
  scheme: "shari",
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
    // YouTube アプリの「共有」は URL を text/plain として ACTION_SEND で渡してくる。
    // 受け取った text は起動時に Linking 経由で抽出する（src/lib/shareIntent.ts）。
    intentFilters: [
      {
        action: "SEND",
        category: ["DEFAULT"],
        data: { mimeType: "text/plain" },
      },
    ],
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  extra: {
    trpcUrl,
  },
};

export default config;
