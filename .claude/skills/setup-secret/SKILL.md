---
name: setup-secret
description: shari の backend に新しい環境変数 / シークレットを追加するときに、wrangler.toml・worker-configuration.d.ts・.dev.vars.example・Cloudflare Workers Secret の **4箇所を漏れなく更新する**。どこか1つ漏れるとローカル or 本番で型エラー or 起動失敗になる。
---

# setup-secret — 環境変数追加の完全手順

## 目的

新しいシークレット（例: `STRIPE_SECRET_KEY`）を足すときに **更新漏れによる事故** を防ぐ。
特に「ローカルでは動くのに本番で `env.X is undefined`」「型は通るのに値が来ない」は全て更新漏れが原因。

## 更新する4箇所

| #   | ファイル / 場所                                             | 役割                                                        |
| --- | ----------------------------------------------------------- | ----------------------------------------------------------- |
| 1   | `apps/backend/worker-configuration.d.ts` の `Env` interface | TypeScript の型（`env.X` の補完・型チェック）               |
| 2   | `apps/backend/.dev.vars.example`                            | チームに「この変数が必要」と伝える / セットアップ手順の入口 |
| 3   | `apps/backend/.dev.vars`（個人ローカル）                    | wrangler dev が読む実値。**git管理外**                      |
| 4   | Cloudflare Workers Secret（本番）                           | `wrangler secret put <KEY>` で投入                          |

**任意（必要なら）**: `apps/backend/wrangler.toml` の `[vars]` セクション。**ただし非機密の固定値だけ**（feature flag 等）。シークレットは絶対に書かない

## 手順

1. **その変数が「シークレット」か「設定」か** を分類
   - シークレット（APIキー・トークン・パスワード・サーバ専用Supabaseキー）→ 全4箇所
   - 設定（feature flag・環境名・URL等）→ `wrangler.toml [vars]` + 型定義 の2箇所で十分

2. **型定義を更新**: `apps/backend/worker-configuration.d.ts`

   ```ts
   export interface Env {
     // ...既存...
     STRIPE_SECRET_KEY: string; // 必須なら : string、任意なら ?: string
   }
   ```

   サーバ専用の機密値はコメントで明示する（例: `/** サーバ専用。mobileに渡さない。 */`）

3. **example を更新**: `apps/backend/.dev.vars.example` に空値で1行追加

   ```
   STRIPE_SECRET_KEY=
   ```

   先頭にカテゴリコメント（`# --- Stripe ---` 等）を入れて見やすく保つ

4. **個人ローカルに実値を入れる**: `apps/backend/.dev.vars`（git管理外）に値を入れる。
   ファイルが無ければ `cp apps/backend/.dev.vars.example apps/backend/.dev.vars` から開始

5. **本番に投入**:

   ```bash
   pnpm --filter @shari/backend exec wrangler secret put STRIPE_SECRET_KEY
   ```

   プロンプトで値を貼り付け。**ターミナル履歴に値を残さないよう、コマンドラインに値を書かない**

6. **動作確認**: `pnpm --filter @shari/backend dev` でローカル起動 → エンドポイントを叩いて `env.STRIPE_SECRET_KEY` が読めること

## チェックリスト（PR出す前に最終確認）

- [ ] `worker-configuration.d.ts` の `Env` に追加した
- [ ] `.dev.vars.example` に空値で追加した
- [ ] 自分の `.dev.vars` に実値を入れた（git status に出ないことを確認）
- [ ] 本番 Cloudflare に `wrangler secret put` で投入した
- [ ] PR 本文に「`STRIPE_SECRET_KEY` を追加。本番投入済み」と明記した
- [ ] **実値をコード・コミット・PR・ログに残していない**

## やってはいけないこと

- ❌ `wrangler.toml` の `[vars]` にシークレットを書く（**全公開リポジトリにバラまかれる**）
- ❌ `.dev.vars.example` に実値を書く
- ❌ `console.log(env)` で全環境変数を吐く（特に本番Workersのログは Cloudflare に残る）
- ❌ mobile 側に渡す目的で `EXPO_PUBLIC_*` プレフィックスを付けてシークレットを露出する（`EXPO_PUBLIC_*` はバンドルに焼き込まれる）

## 削除するとき

逆順で削除:

1. `wrangler secret delete STRIPE_SECRET_KEY`
2. `.dev.vars` / `.dev.vars.example` から行削除
3. `worker-configuration.d.ts` の Env から削除
4. コード内の `env.STRIPE_SECRET_KEY` 参照を削除（最後にやると型エラーで検知できる）
