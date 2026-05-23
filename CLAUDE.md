# shari

YouTube技術動画を日本のエンジニア向けに日本語要約するモバイルアプリ。
詳細な背景・設計判断は [docs/architecture.md](./docs/architecture.md) を参照。

## 技術スタック

| レイヤ              | 採用                                                      |
| ------------------- | --------------------------------------------------------- |
| モバイル            | Expo 56 + TypeScript（iOS / Android）                     |
| バックエンド        | Hono + tRPC + Zod on Cloudflare Workers（東京リージョン） |
| DB / 認証 / Storage | Supabase（PostgreSQL）                                    |
| AI                  | Claude API（要約・翻訳）                                  |
| 外部API             | YouTube Transcript API / Qiita API / Zenn RSS             |
| Monorepo            | pnpm@11 workspace + Turborepo                             |
| ランタイム          | Node.js 22.13+                                            |

## リポジトリ構成

```
shari/
├── apps/
│   ├── mobile/        # Expo（iOS / Android）
│   └── backend/       # Hono on Cloudflare Workers
├── packages/
│   ├── api/           # tRPC router（mobile から型として参照）
│   └── shared/        # Zod schema・共通型・ドメインロジック
```

## よく使うコマンド

```bash
# 全パッケージまとめて
pnpm dev                              # 開発サーバ起動（Turborepo）
pnpm build                            # 全パッケージビルド
pnpm typecheck                        # 型チェック（tsc --noEmit）
pnpm lint                             # lint（現状は tsc --noEmit を流用）

# 個別
pnpm --filter @shari/backend dev      # wrangler dev（:8787）
pnpm --filter @shari/mobile dev       # expo start
pnpm --filter @shari/backend deploy   # Cloudflare Workers にデプロイ
```

## コードスタイル

- TypeScript strict + `noUncheckedIndexedAccess`。`any` 禁止（`unknown` + 絞り込みで対応）
- 型シェアは `import type { AppRouter } from '@shari/api'` を使う。相対パスでの cross-package import 禁止
- 入力値は必ず Zod でバリデーションしてから利用
- Expo は v56 固定。新規コードを書く前に必ず https://docs.expo.dev/versions/v56.0.0/ を参照（バージョン差異が大きい）
- コミットメッセージは Conventional Commits（種別は英語、本文は日本語）。詳細は `/commit` スキル参照

## 禁止事項

- `.env` `.dev.vars` `.env.*`（`.example` を除く）を絶対にコミットしない
- `any` 型の使用禁止
- API キー・トークンをコード内にハードコードしない（Cloudflare Workers Secrets / Expo の `EXPO_PUBLIC_*` を経由）
- `apps/backend` で Node 専用API（`fs`, `child_process` 等）を使わない（Workers ランタイム非対応）

## 確認が必要な操作（人間判断必須）

- `git push` to main
- Supabase の DB migration 実行
- `wrangler deploy`（本番Workers反映）
- `rm -rf` を含む削除
- Claude API への本番呼び出しを伴う動作確認

## ワークフロー

1. 作業開始前に `git status` と `pnpm typecheck` をクリーンに
2. PR は日本語で背景・変更点・テスト方針を記述
3. マージ前に `/code-review` スキルで OWASP + パフォーマンス観点を自己レビュー
4. コミット作成は `/commit` スキルを使うと Conventional Commits 形式が担保される
