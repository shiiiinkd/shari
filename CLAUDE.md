# shari

YouTube技術動画を日本のエンジニア向けに日本語要約するモバイルアプリ。
設計判断・背景は [docs/architecture.md](./docs/architecture.md) を参照。

## 技術スタック

| レイヤ              | 採用                                                      |
| ------------------- | --------------------------------------------------------- |
| モバイル            | Expo 54 + TypeScript（iOS / Android）                     |
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
pnpm dev                              # 開発サーバ起動（Turborepo）
pnpm build                            # 全パッケージビルド
pnpm typecheck                        # 型チェック（tsc --noEmit）
pnpm lint                             # ESLint
pnpm format                           # Prettier 整形
pnpm --filter @shari/backend dev      # wrangler dev（:8787）
pnpm --filter @shari/mobile dev       # expo start
pnpm --filter @shari/backend deploy   # Cloudflare Workers にデプロイ
```

## コードスタイル

- TypeScript strict + `noUncheckedIndexedAccess`。`any` 禁止（`unknown` + 絞り込みで対応）
- 入力値は必ず Zod でバリデーションしてから利用
- Expo は v54 固定（ストア配信の Expo Go が SDK54 までのため上げない）。新規コード前に必ず https://docs.expo.dev/versions/v54.0.0/ を参照
- コミットは Conventional Commits（種別英語・本文日本語）。詳細は `/commit` スキル参照

## レイヤ境界（要点）

詳細は [docs/architecture.md の「レイヤ境界と不変ルール」](./docs/architecture.md#9-レイヤ境界と不変ルール) 参照。実装前にここを確認:

- `packages/shared`: フロント・バック両参照のため **ランタイム非依存コードのみ**
- `packages/api`: tRPC router は mobile への公開IF。破壊的変更は mobile 側影響を必ず確認
- `apps/backend`: Workers 制約あり（Node.js 専用API 不可・CPU時間制限・isolate 越し状態共有 NG）
- DB は Supabase クライアント経由のみ。**生SQL 直書き禁止**

## 提案スタンス

設計判断レベルの選択（architecture.md に影響・新規パッケージ追加・ライブラリ採用等）では、
推奨を1つ明示し、却下案との比較と根拠（保守性・型安全性・スタック整合性・Workers制約適合）を示す。
小さな選択（命名・既存規約内の小判断）は1〜2文で推奨 + 根拠で十分。

## 禁止事項

- `.env` `.dev.vars` `.env.*`（`.example` 除く）を絶対にコミットしない
- `any` 型の使用禁止
- API キー・トークンをコードにハードコードしない（Workers Secrets / `EXPO_PUBLIC_*` を経由）
- `apps/backend` で Node.js 専用 API を使わない（Workers ランタイム非対応）
- cross-package import を相対パスで行わない（`@shari/*` エイリアス必須）

## 確認が必要な操作（人間判断必須・自動実行禁止）

- `git push` to main
- Supabase の DB migration 実行
- `wrangler deploy`（本番 Workers 反映）
- `rm -rf` を含む削除
- Claude API への本番呼び出しを伴う動作確認

## ワークフロー

1. 作業開始前に `git status` + `pnpm typecheck` がクリーンであることを確認
2. 実装前に上記レイヤ境界と関連 skill（`/setup-secret` `/add-trpc-procedure` `/expo-dev`）を確認
3. 変更後は `pnpm typecheck` を実行してから次タスクへ
4. PR は日本語で「背景・変更点・テスト方針」を記述
5. マージ前に `/code-review` スキルで OWASP + パフォーマンス観点を自己レビュー
6. コミット作成は `/commit` スキル

## 並列開発（worktree）

複数の Claude Code インスタンスを git worktree で並列に動かす場合は、必ず [docs/worktree-rules.md](./docs/worktree-rules.md) を読んでから着手する。
（配置・命名・並列禁止の組み合わせ・マージ順序・`.claude-task.md` での担当範囲明示など）
