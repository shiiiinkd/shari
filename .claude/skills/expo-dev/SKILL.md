---
name: expo-dev
description: shari の mobile（Expo）を開発機で動かすときの backend URL 切替・wrangler dev との同時起動・よくあるネットワークエラーの対処をまとめたランブック。iOS Sim / Android Emu / 実機 で踏むポイントが違うので、毎回ここを参照する。
---

# expo-dev — mobile を実機/エミュレータで動かす

## 目的

mobile から backend（Cloudflare Workers のローカル: `wrangler dev`）に繋ぐとき、
**「iOS Sim では動くのに Android Emu では繋がらない」「実機からだと CORS で落ちる」** 等の罠を最短で抜ける。

## TL;DR

```bash
# ターミナル1
pnpm --filter @shari/backend dev    # → http://localhost:8787

# ターミナル2
pnpm --filter @shari/mobile dev     # → expo start
```

その上で `apps/mobile/src/lib/trpc.ts` の `TRPC_URL` を **実行環境に応じて** 切り替える（下表参照）。

## URL 早見表

| 実行環境                      | TRPC_URL に入れる値                                                          |
| ----------------------------- | ---------------------------------------------------------------------------- |
| iOS Simulator                 | `http://localhost:8787/trpc`                                                 |
| Android Emulator（標準 AVD）  | `http://10.0.2.2:8787/trpc`（エミュからホストの loopback）                   |
| iOS / Android 実機（同一LAN） | `http://<開発機のLAN IP>:8787/trpc`（例: `http://192.168.1.42:8787/trpc`）   |
| Expo Go（Tunnel モード）      | 同上（LAN IP を使う）。Tunnel は HTTPS だが backend は HTTP なので推奨しない |

**LAN IP の確認**:

```bash
ipconfig getifaddr en0    # macOS Wi-Fi
# → 192.168.x.x
```

## 推奨: ハードコードを排除する

現状 `apps/mobile/src/lib/trpc.ts:21` で URL がハードコードされている（コメントで「MVP前に整理」とTODO）。
最終的には以下の形に持っていく:

### `apps/mobile/app.config.ts`（`app.json` を差し替え）

```ts
import type { ExpoConfig } from "expo/config";

const trpcUrl = process.env.EXPO_PUBLIC_TRPC_URL ?? "http://localhost:8787/trpc";

const config: ExpoConfig = {
  name: "mobile",
  slug: "mobile",
  // ...既存の app.json の中身...
  extra: {
    trpcUrl,
  },
};

export default config;
```

### `apps/mobile/.env.local`（git管理外）

```
EXPO_PUBLIC_TRPC_URL=http://10.0.2.2:8787/trpc
```

### `apps/mobile/src/lib/trpc.ts` を更新

```ts
import Constants from "expo-constants";

export const TRPC_URL =
  (Constants.expoConfig?.extra?.trpcUrl as string | undefined) ?? "http://localhost:8787/trpc";
```

これで `EXPO_PUBLIC_TRPC_URL` を環境ごとに切り替えれば、コードを触らず URL を変更できる。

## CORS

`apps/backend/src/index.ts` で `cors({ origin: "*" })` になっている（開発向け）。
本番デプロイ前に **アプリの起源を明示**:

```ts
app.use(
  "*",
  cors({
    origin: ["https://shari.app", "exp://"], // 本番web + Expo Go
    allowMethods: ["GET", "POST", "OPTIONS"],
  }),
);
```

## よくあるエラーと対処

| 症状                                                     | 原因                                                 | 対処                                                                                                                  |
| -------------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `Network request failed`（Android Emu）                  | `localhost` をエミュ内 loopback として解釈している   | URL を `10.0.2.2` に変更                                                                                              |
| `Network request failed`（実機）                         | 開発機の LAN IP が変わった or 別Wi-Fi に繋がっている | `ipconfig getifaddr en0` で再確認、両端末を同じWi-Fiに                                                                |
| iOS で `App Transport Security blocks ... http://`       | iOS が HTTP を拒否（本番ビルド時）                   | dev中は `app.json` の `ios.infoPlist.NSAppTransportSecurity.NSAllowsLocalNetworking = true` を許容、本番は HTTPS 必須 |
| `Failed to compile`（型エラー）                          | `@shari/api` の Router 型が更新されていない          | `pnpm install`、それでもダメなら `pnpm clean && pnpm install`                                                         |
| `Metro bundler cache が壊れた`                           | watchman / metro のキャッシュ                        | `pnpm --filter @shari/mobile exec expo start -c`                                                                      |
| `pnpm dev` で両方起動したいのに backend が立ち上がらない | turbo の `dev` タスクが persistent で順序保証なし    | ターミナル2枚で個別 `pnpm --filter` 起動を推奨                                                                        |

## チェックリスト（接続詰まったとき）

- [ ] backend が `http://localhost:8787` で応答するか: `curl http://localhost:8787/`
- [ ] 端末から開発機に到達できるか: `curl http://<LAN_IP>:8787/`（同じWi-Fi端末から）
- [ ] `TRPC_URL` が実行環境に正しい値か（上の表）
- [ ] CORS allow に該当 origin が入っているか
- [ ] CORS preflight: `curl -X OPTIONS http://localhost:8787/trpc/hello -i`
- [ ] `pnpm typecheck` がクリーンか（router 型のズレ確認）

## やってはいけないこと

- ❌ 本番ビルドで `cors origin: "*"` のまま出す
- ❌ `TRPC_URL` を `localhost` のまま実機ビルドしてストア提出（必ず本番URL）
- ❌ `EXPO_PUBLIC_*` にシークレット（APIキー等）を入れる（**バンドルに焼き込まれて公開される**）
