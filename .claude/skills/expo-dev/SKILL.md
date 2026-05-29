---
name: expo-dev
description: shari の mobile（Expo）を開発機で動かすときの backend URL 切替・wrangler dev との同時起動・よくあるネットワークエラーの対処をまとめたランブック。iOS Sim / Android Emu / 実機 で踏むポイントが違うので、毎回ここを参照する。
---

# expo-dev — mobile を実機/エミュレータで動かす

## 目的

mobile から backend（Cloudflare Workers のローカル: `wrangler dev`）に繋ぐとき、
**「iOS Sim では動くのに Android Emu では繋がらない」「実機からだと CORS で落ちる」** 等の罠を最短で抜ける。

## TL;DR

URL は `src/lib/trpc.ts` の `resolveTrpcUrl` が**自動解決**する。同一 WiFi なら手で切替不要。

```bash
# 実機(Expo Go / iOS)で確認 — backend を LAN 公開(--ip 0.0.0.0)で起動
pnpm dev        # backend(0.0.0.0) + expo start。スマホで QR を読む → LAN IP 自動導出

# Web で確認 — backend は localhost
pnpm dev:web    # backend(localhost) + expo start --web
```

- `pnpm dev` = 実機 Expo Go 用（Mac とスマホが**同一 WiFi**のとき）
- `pnpm dev:web` = Web 用
- 出先（スマホが別ネットワーク）は下の「出先：トンネル接続」を参照。

## URL 早見表（resolveTrpcUrl が自動で選ぶ値）

手動設定は基本不要。`EXPO_PUBLIC_TRPC_URL` を設定したときだけ上書きされる。

| 実行環境                      | 解決される値                                                                              |
| ----------------------------- | ----------------------------------------------------------------------------------------- |
| Web                           | `http://localhost:8787/trpc`                                                              |
| iOS / Android 実機（同一LAN） | `http://<hostUri の LAN IP>:8787/trpc`（自動導出。`pnpm dev` で backend を 0.0.0.0 起動） |
| iOS Simulator                 | hostUri から導出、取れなければ `http://localhost:8787/trpc`                               |
| Android Emulator（標準 AVD）  | 必要なら `EXPO_PUBLIC_TRPC_URL=http://10.0.2.2:8787/trpc` で上書き                        |
| 出先（別ネットワーク）        | トンネル必須 → 下記「出先：トンネル接続」                                                 |

**LAN IP の確認**（デバッグ時）:

```bash
ipconfig getifaddr en0    # macOS Wi-Fi
# → 192.168.x.x
```

## URL 解決ロジック（実装済み）

`apps/mobile/src/lib/trpc.ts` の `resolveTrpcUrl()` が実行環境から自動で URL を決める（ハードコードは廃止済み）:

1. `EXPO_PUBLIC_TRPC_URL`（`.env` → `app.config.ts` の `extra.trpcUrl`）が**明示されていれば最優先** … 出先トンネル・本番用
2. **Web** → `http://localhost:8787/trpc`（SSH ポートフォワードで到達）
3. **実機 / Simulator** → Metro 接続ホスト（`Constants.expoConfig.hostUri` ／ なければ `expoGoConfig.debuggerHost`）から LAN IP を取り出し `:8787` に接続

→ Mac とスマホが**同一 WiFi**なら `.env` を触らず実機で繋がる。

**重要1（backend のバインド）**: 実機が LAN IP で backend に届くには全インターフェースで listen させる必要がある。
`pnpm dev`（backend）は `wrangler dev --port 8787 --ip 0.0.0.0` で起動する（`dev:web` は localhost のまま）。
`--ip 0.0.0.0` は dev backend を LAN に晒すので、公衆 WiFi では注意（その場合は `dev:web` か Web で確認）。

**重要2（hostUri が `127.0.0.1` になる問題）**: 開発機が複数 NIC（en0/en1 + Tailscale 等の `utun` 100.x）を持つと、
`expo start` / `--host lan` は LAN IP を選べず hostUri を `127.0.0.1` で出し、実機が backend に届かない。
→ `pnpm dev`（mobile）は `apps/mobile/scripts/start-lan.mjs` 経由で起動し、LAN IPv4（`192.168.x` 優先・loopback/Tailscale 除外）を
自動検出して `REACT_NATIVE_PACKAGER_HOSTNAME` に渡す。Web（`dev:web`）はこのラッパーを通さないので影響しない。

**デバッグ**: 実機を使わずに Metro が実際に出す hostUri を確認できる:

```bash
curl -s -H "expo-platform: ios" -H "expo-protocol-version: 1" \
  -H "Accept: multipart/mixed, application/expo+json, application/json" \
  http://localhost:8081/ | tr ',' '\n' | grep -iE "hostUri|debuggerHost"
```

## 出先：トンネル接続（スマホが Mac と別ネットワークのとき）

LAN IP は届かないので Metro と backend を**両方**公開する:

```bash
# 1. backend を公開（無料の即席トンネル。HTTPS URL が出る）
cloudflared tunnel --url http://localhost:8787
#   → https://xxxx.trycloudflare.com を控える

# 2. その URL を override に設定（末尾に /trpc）
echo 'EXPO_PUBLIC_TRPC_URL=https://xxxx.trycloudflare.com/trpc' >> apps/mobile/.env

# 3. Metro をトンネルモードで起動
pnpm --filter @shari/mobile exec expo start --tunnel
```

- 即席トンネルの URL は**起動ごとに変わる** → 毎回 `.env` 更新 + expo 再起動が要る。固定したいなら named tunnel / 独自ドメイン or ngrok の予約ドメイン。
- ネイティブ fetch は CORS 非適用なので backend CORS はそのままで可。トンネルは HTTPS なので iOS ATS も問題なし。
- 手軽さ優先なら出先は `pnpm dev:web`（Web）が確実。

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

| 症状                                                     | 原因                                                                    | 対処                                                                                                                                               |
| -------------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Network request failed`（Android Emu）                  | `localhost` をエミュ内 loopback として解釈している                      | URL を `10.0.2.2` に変更                                                                                                                           |
| `Network request failed`（実機）                         | 開発機の LAN IP が変わった or 別Wi-Fi に繋がっている                    | `ipconfig getifaddr en0` で再確認、両端末を同じWi-Fiに                                                                                             |
| 実機で即「通信エラー」/ 接続先が `127.0.0.1`             | 複数 NIC(Tailscale 等)で expo が LAN IP を選べず hostUri が `127.0.0.1` | `pnpm dev` で起動（`start-lan.mjs` が `REACT_NATIVE_PACKAGER_HOSTNAME` を自動設定）。手動なら `REACT_NATIVE_PACKAGER_HOSTNAME=<LAN IP> expo start` |
| iOS で `App Transport Security blocks ... http://`       | iOS が HTTP を拒否（本番ビルド時）                                      | dev中は `app.json` の `ios.infoPlist.NSAppTransportSecurity.NSAllowsLocalNetworking = true` を許容、本番は HTTPS 必須                              |
| `Failed to compile`（型エラー）                          | `@shari/api` の Router 型が更新されていない                             | `pnpm install`、それでもダメなら `pnpm clean && pnpm install`                                                                                      |
| `Metro bundler cache が壊れた`                           | watchman / metro のキャッシュ                                           | `pnpm --filter @shari/mobile exec expo start -c`                                                                                                   |
| `pnpm dev` で両方起動したいのに backend が立ち上がらない | turbo の `dev` タスクが persistent で順序保証なし                       | ターミナル2枚で個別 `pnpm --filter` 起動を推奨                                                                                                     |

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
