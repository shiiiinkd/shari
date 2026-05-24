/**
 * OS 標準共有メニュー / deep link で起動した際の URL を取得するための純粋 hook。
 *
 * - iOS: custom scheme `shari://...`（Universal Links は Phase 2 以降）
 * - Android: `android.intent.action.SEND`（YouTube アプリの「共有」→ shari）
 *   text/plain の EXTRA_TEXT が Linking 経由で取得できる前提。
 *
 * 動作確認は EAS 開発ビルド必須。Expo Go では custom scheme / Intent Filter
 * が無視されるため、本 hook の値は常に null になる。
 *
 * 画面側のロジックは React Navigation の `linking` config（B 担当）で
 * route param に流すのが正規ルート。本 hook は「受信した生 URL を直接
 * 触りたい」場面の補助として、または ACTION_SEND の EXTRA_TEXT のように
 * navigation 経由で route に乗らないケースのフォールバックとして使う。
 *
 * Expo 56: https://docs.expo.dev/versions/v56.0.0/sdk/linking/
 */
import { useEffect, useState } from "react";
import { Linking } from "react-native";

export type ShareIntent = {
  /** OS から受け取った URL / SEND text。未受信なら null。 */
  url: string | null;
};

// アプリ起動と React マウントの間で初期 URL を落とさないためのモジュール内キャッシュ。
// primeShareIntent() を index.ts から早期に呼ぶことで、Linking.getInitialURL の
// 取得を navigation の描画と並走させる。React Navigation の linking config も
// 自前で getInitialURL を呼ぶが、Linking 側で内部キャッシュされる API のため
// 二重呼び出しでも副作用は無い。
let cachedInitialUrl: string | null = null;
let initialUrlPromise: Promise<string | null> | null = null;

export function primeShareIntent(): Promise<string | null> {
  if (initialUrlPromise) {
    return initialUrlPromise;
  }
  initialUrlPromise = Linking.getInitialURL()
    .then((value) => {
      cachedInitialUrl = value;
      return value;
    })
    .catch(() => null);
  return initialUrlPromise;
}

export function useShareIntent(): ShareIntent {
  const [url, setUrl] = useState<string | null>(cachedInitialUrl);

  useEffect(() => {
    let cancelled = false;

    primeShareIntent().then((initial) => {
      if (!cancelled && initial) {
        setUrl((prev) => prev ?? initial);
      }
    });

    const subscription = Linking.addEventListener("url", (event) => {
      if (event.url) {
        setUrl(event.url);
      }
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  return { url };
}
