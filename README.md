# Shari 🍣

YouTube技術動画を日本のエンジニア向けに日本語要約するモバイルアプリ。

> 寿司のシャリに由来。表面のネタ（情報）を支える本質という意味。
> 動画という表面から本質を取り出すというコンセプトと一致。

---

## プロダクト概要

- **ターゲット**: 日本のエンジニア・IT職種
- **コア体験**: YouTube URLを共有 → 1〜2秒で日本語要約 + 関連Qiita/Zenn記事を提示
- **差別化**: 日本語ネイティブ品質の要約・翻訳、エンジニア向け関連記事連携

詳細は要件書を参照。

---

## 技術スタック

| レイヤ       | 採用                                                      |
| ------------ | --------------------------------------------------------- |
| モバイル     | Expo + TypeScript（iOS / Android 同時対応）               |
| バックエンド | Hono + tRPC + Zod on Cloudflare Workers（東京リージョン） |
| DB / 認証    | Supabase（PostgreSQL + Auth + Storage）                   |
| AI           | Claude API（要約・日本語翻訳）                            |
| 外部API      | YouTube Transcript API・Qiita API・Zenn RSS               |
| Monorepo     | pnpm workspace + Turborepo                                |

---

## リポジトリ構成

```
shari/
├── apps/
│   ├── mobile/        # Expo（iOS / Android）
│   └── backend/       # Hono on Cloudflare Workers
├── packages/
│   ├── api/           # tRPC router 定義（型シェア用）
│   └── shared/        # Zod schema・共通型・ドメインロジック
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

---

## セットアップ

### 前提

- Node.js 20以上
- pnpm（`corepack enable` で有効化可）
- Xcode（iOS実機/シミュレータ実行時）/ Android Studio（Android時）
- Cloudflare アカウント（デプロイ時）
- Supabase アカウント

### 初回セットアップ

```bash
corepack enable
pnpm install
```

### 開発サーバ起動

```bash
# 全部まとめて起動（Turborepo）
pnpm dev

# 個別に起動
pnpm --filter @shari/backend dev    # Cloudflare Workers（ローカル）
pnpm --filter @shari/mobile dev     # Expo Dev Server
```

### ビルド

```bash
pnpm build
```

---

## 環境変数

`.env.example` を `.env` にコピーして値を設定。

| キー                | 用途                                |
| ------------------- | ----------------------------------- |
| `ANTHROPIC_API_KEY` | Claude API                          |
| `SUPABASE_URL`      | Supabase エンドポイント             |
| `SUPABASE_ANON_KEY` | Supabase クライアント鍵             |
| `QIITA_TOKEN`       | Qiita API（任意・レート制限緩和用） |

---

## ライセンス

未定（個人プロジェクト・現時点ではprivate）
