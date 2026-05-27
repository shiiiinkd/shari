# shari アーキテクチャ

> 最終更新: 2026-05-23
> ベース要件: `obsidian-vault/20_AI-BRAIN/プロジェクト/Youtube要約/技術要件.md`（社内Obsidian）

このドキュメントは **「なぜそうなっているか」** を残すことが目的。
ファイル構造や使用ライブラリは `package.json` を真とし、ここでは設計判断と根拠だけ書く。

---

## 1. プロダクト概要

- **ターゲット**: 日本のエンジニア・IT職種
- **コア体験**: YouTube URL を共有 → 1〜2秒で日本語要約 + 関連 Qiita / Zenn 記事を提示
- **差別化軸**: 日本語ネイティブ品質の要約・翻訳 / エンジニア向け関連記事連携 / モバイルファースト

### MVP スコープ

含む:

- YouTube URL からの字幕取得（YouTube Transcript API・字幕あり動画のみ）
- Claude API での要約 + 日本語翻訳
- Qiita / Zenn から関連記事検索

含まない（Phase 2以降）:

- 字幕なし動画（Whisper による文字起こし）
- 図解生成 / 英語学習モード / Notion・Obsidian 連携 / LINE 共有 / チャンネル定期要約 / Share Extension

---

## 2. システム構成

```
┌─────────────────────────────────────────┐
│  Expo Mobile (iOS / Android)            │
│  - React Native 0.85 / React 19          │
│  - tRPC Client (型は @shari/api から)    │
└──────────────┬──────────────────────────┘
               │  HTTPS + tRPC (TypeScript型安全)
               ▼
┌─────────────────────────────────────────┐
│  Hono on Cloudflare Workers (東京)       │
│  - tRPC Server + Zod                     │
│  - @hono/trpc-server                     │
└──┬────────────┬─────────────┬───────────┘
   │            │             │
   ▼            ▼             ▼
┌────────┐ ┌──────────┐ ┌───────────────┐
│Supabase│ │Claude API│ │YouTube/Qiita/ │
│Postgres│ │ (要約/翻訳)│ │Zenn (外部API) │
│Auth/Stg│ │           │ │                │
└────────┘ └──────────┘ └───────────────┘
```

---

## 3. リポジトリ構成

```
shari/
├── apps/
│   ├── mobile/        # Expo（iOS / Android）
│   └── backend/       # Hono on Cloudflare Workers
├── packages/
│   ├── api/           # tRPC router 定義（型シェア用）
│   └── shared/        # Zod schema・共通型・ドメインロジック
├── docs/
│   └── architecture.md（このファイル）
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

### なぜ最初から monorepo か

当初案では「Web需要確認時に Turborepo 移行」だったが、**最初から monorepo** に変更している。理由:

1. **tRPC + Expo + Hono の標準規約**: `create-t3-turbo` / `create-better-t-stack` 等の公式・主要スターターはすべて pnpm workspace + Turborepo。型シェアの仕組み上これがデファクト
2. **型共有が綺麗**: mobile は `import type { AppRouter } from '@shari/api'` で参照可能。相対パス（`../../backend/src/router`）は明確なコードスメル
3. **ユーザー層がエンジニア**: リポジトリ構造そのものが評価対象になるため、標準規約に乗ることで信頼性が上がる
4. **後で移行する方が高コスト**: コードが育ってから全importパスを書き換えるより、初期に1度設定する方が安い
5. **Web追加コストがゼロ**: `apps/web/`（Next.js）を足すだけで Web 対応可能。`packages/api` / `packages/shared` はそのまま再利用される

---

## 4. データフロー（要約処理）

```
[1] ユーザーが YouTube URL を mobile アプリに共有
       │
[2] mobile → tRPC.summary.create({ url })
       │
[3] backend: Zod で URL を検証・videoId を抽出
       │
[4] backend → Supabase: videoId で既存要約をキャッシュ参照
       │   ├─ hit: そのまま返却（Claude API 呼ばない＝コスト削減）
       │   └─ miss: 次へ
       │
[5] backend → YouTube Transcript API: 字幕取得（無料・1〜2秒）
       │   └─ 字幕なし: TRPCError(NOT_FOUND, 'transcript_unavailable')
       │
[6] backend → Claude API: 字幕 → 要約 + 日本語翻訳（1コール）
       │
[7] backend → Qiita API + Zenn RSS: 関連記事3件取得（並列）
       │
[8] backend → Supabase: 要約 + 関連記事を保存（次回キャッシュ用）
       │
[9] mobile: 要約 + 関連記事を表示
```

### 重要な制約

- **Cloudflare Workers CPU 上限**: Free 10ms / Paid Standard 30s。Claude API レスポンス待ちはサブリクエストとして扱われ CPU 時間には乗らないので長時間呼び出しはOK
- **Workers サブリクエスト数上限**: 1 リクエスト 50 件。Qiita / Zenn を扇形展開しすぎないこと
- **Claude API コスト**: 約 ¥10〜15 / 動画。**Supabase によるキャッシュは MVP から必須**（無いとサブスク経済性が崩れる）

---

## 5. 技術選定の根拠

| 技術                             | 選定理由                                                                                                            |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Hono**                         | 日本人開発者作・エッジ対応・TypeScript完全対応                                                                      |
| **tRPC + Zod**                   | フロント〜バック間の型安全を担保・APIドキュメント不要                                                               |
| **Cloudflare Workers**           | 東京リージョン・無料枠10万req/日・サーバーレス                                                                      |
| **Supabase**                     | OSS・ロックインなし・無料枠で開始可能・Auth/Storage同梱                                                             |
| **Claude API**                   | 現時点で最高水準の日本語生成品質                                                                                    |
| **Expo (Bare ではなく Managed)** | iOS/Android 同時対応のコスト最小化。Share Extension 必要になったら Bare 移行検討                                    |
| **pnpm@11 + Turborepo**          | monorepo + tRPC スタックのデファクト。`overrides` で react / react-native の単一バージョンを強制（Expo の必須要件） |

---

## 6. 環境変数

`.env.example` を `.env` にコピー（backend は `.dev.vars` を使用）。

| キー                        | 用途                                | 配置先                                                     |
| --------------------------- | ----------------------------------- | ---------------------------------------------------------- |
| `ANTHROPIC_API_KEY`         | Claude API                          | Cloudflare Workers Secret（本番）/ `.dev.vars`（ローカル） |
| `SUPABASE_URL`              | Supabase エンドポイント             | Workers Secret + Expo `EXPO_PUBLIC_*`                      |
| `SUPABASE_ANON_KEY`         | Supabase クライアント鍵             | Workers Secret + Expo `EXPO_PUBLIC_*`                      |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase サーバ専用鍵               | **Workers Secret のみ**（mobile には絶対に渡さない）       |
| `QIITA_TOKEN`               | Qiita API（任意・レート制限緩和用） | Workers Secret                                             |

`.env` / `.dev.vars` は `.gitignore` 済み。コミットしてはいけない。

---

## 7. コスト構造

| ステップ                    | 手段                          | コスト            |
| --------------------------- | ----------------------------- | ----------------- |
| 字幕取得（字幕あり・約90%） | YouTube Transcript API        | 無料              |
| 字幕取得（字幕なし・約10%） | MVP対象外                     | —                 |
| 要約・翻訳                  | Claude API                    | 約 ¥10〜15 / 動画 |
| 関連記事検索                | Qiita / Zenn API              | 無料              |
| インフラ                    | Cloudflare Workers + Supabase | 無料枠で開始      |

**加重平均コスト**: 約 ¥10〜15 / 動画。**Pro 有料ユーザー 約400名で月次黒字化**が目安。

---

## 8. 将来拡張ポイント

### 字幕取得・LLM ロードマップ

**MVP (現状)**: Supadata Transcript API で字幕取得 → Claude API で要約。

字幕取得は 2026 年に YouTube が PoT (Proof of Origin Token) を強制したため、Workers の fetch だけで字幕を引く経路 (Innertube / HTML scrape) は全滅した。当面は外部 SaaS に逃がす。

LLM・Transcript provider は両方とも抽象化レイヤ越しに呼んでいる。差し替え箇所:

- `apps/backend/src/clients/llm.ts` — `LlmClient` interface (`ClaudeClient` が現行実装)
- `apps/backend/src/services/transcript.ts` — `TranscriptProvider` interface (`SupadataProvider` が現行実装)
- 切替は env (`LLM_PROVIDER` / `TRANSCRIPT_PROVIDER`) で行う

#### Phase 2: GeminiClient 実装 / Claude vs Gemini 切替可能化

- `apps/backend/src/clients/llm.ts` に `GeminiClient` を追加
- `LLM_PROVIDER=gemini` で起動時に Gemini に切り替わる
- 価格・要約品質を AB 比較できる構造に
- Gemini SDK か直 fetch (`generativelanguage.googleapis.com/v1beta/models/...`) のどちらでも可
- 既存 summaries テーブルの `prompt_version` が自動的に変わるためキャッシュ汚染なし

#### Phase 3: Gemini 動画直接処理への移行検討

- Gemini API は YouTube URL を直接渡せる ([公式ドキュメント](https://ai.google.dev/gemini-api/docs/vision))
- これが実用速度・品質に達した時点で、字幕取得自体を bypass する選択肢が出てくる
- メリット: Supadata 依存解消、字幕無し動画対応、映像情報 (スライド・コード・図表) も活用可
- 検討トリガ: ① Gemini Video の応答速度が 10 分動画あたり 30 秒以内 ② 要約品質が現状の「字幕→要約」を上回る
- 移行する場合は `LlmClient` の契約自体を変更する必要あり (今は `transcriptText: string` 前提)

#### Transcript provider 追加候補 (字幕経路の冗長化 / コスト最適化)

- **self-host**: Fly.io / Railway に Node サーバを立て youtubei.js を動かす。Workers → fetch で叩く。Supadata 月額より安くなる規模になったタイミングで検討
- **Whisper fallback**: Supadata / self-host が NOT_FOUND を返した動画 (字幕無し) を Whisper で文字起こし。動画ダウンロードが必要なので Workers 単独では不可、self-host 前提

### Phase 2 その他候補

- 図解生成 / 英語学習モード / Notion・Obsidian 連携 / LINE 共有
- チャンネル定期要約（cron + Workers Queue）

### Phase 3: Share Extension（UX 改善）

現状は YouTube アプリの共有ボタン → shari 起動でアプリ切替が発生する。これを「YouTube の画面上にボトムシート表示」に進化させる手段。

- iOS: Share Extension / Action Extension
- Android: Intent Filter + Share Target
- Expo 実装案: `expo-share-extension`（推奨） / Bare Workflow 移行 / EAS Build カスタムネイティブ

**導入タイミング**: MVP で要約品質を検証 → ユーザーが増えて「アプリ切替の摩擦」が次の課題になったとき。「無いとサービスが成立しない」ではなく「あると UX が一段上がる」機能として位置づける。

### Web 対応

`apps/web/`（Next.js）を追加するだけ。`packages/api` / `packages/shared` はそのまま再利用される。Web 需要が確認できた時点で着手。

---

## 9. レイヤ境界と不変ルール

各パッケージ・アプリの責務と「やってはいけないこと」を明文化する。
CLAUDE.md のレイヤ境界セクションからここを参照しているので、変更時は両方に注意。

### packages/shared

- mobile / backend / 将来の web から共通で参照される
- **ランタイム非依存コードのみ**配置（Node.js API、React Native API、Workers API への直接依存禁止）
- 中身: Zod schema、純粋関数、型定義、ドメインロジック
- 例: YouTube URL → videoId 抽出、字幕テキストの整形

### packages/api

- tRPC router の型定義。mobile への公開IF
- **破壊的変更（procedure 削除・input/output 型変更）は必ず mobile 側の影響を確認**
- 内容: router 構造と Zod schema による input/output。実装本体は backend で書く
- 副作用（DB・外部API呼び出し）は backend 側に持たせ、ここでは型シェアに徹する

### apps/backend (Cloudflare Workers)

Workers ランタイム制約あり:

- **Node.js 専用 API 不可**: `fs`, `child_process`, `net`, `Buffer` の一部
- **CPU 時間**: Free 10ms / Paid Standard 30s。重い同期処理は分割するか Unbound プランへ
- **サブリクエスト**: 1 リクエスト最大 50。`Promise.all` で扇形展開しすぎない（Qiita / Zenn 等）
- **isolate 越しの状態共有 NG**: isolate がリクエスト間で使い回されるため、グローバル変数にユーザー固有データを置かない（漏洩リスク）

DB アクセスは:

- Supabase クライアント経由のみ。**生 SQL 直書き禁止**（型安全と RLS 整合性のため）
- `service_role` キーは backend のみ。mobile に絶対渡さない

### apps/mobile (Expo)

- Expo 56 固定。バージョン差異が大きいので新規コード前に必ず公式 v56 ドキュメント参照
- `EXPO_PUBLIC_*` 環境変数は **バンドルに焼き込まれて公開される**。シークレットを入れない
- tRPC 型は `import type { AppRouter } from "@shari/api"` 経由。**相対パス import 禁止**
- ネイティブモジュール追加時は Expo Managed Workflow の範囲内か事前確認（範囲外なら Bare 移行が必要になる）

---

## 10. 関連ドキュメント

- ルート規約: [../CLAUDE.md](../CLAUDE.md)
- データモデル: [./data-model.md](./data-model.md)
- コミット規約: [../.claude/skills/commit/SKILL.md](../.claude/skills/commit/SKILL.md)
- レビュー観点: [../.claude/skills/code-review/SKILL.md](../.claude/skills/code-review/SKILL.md)
- Expo v56 公式: https://docs.expo.dev/versions/v56.0.0/
- Hono on Workers: https://hono.dev/docs/getting-started/cloudflare-workers
- tRPC v11: https://trpc.io/docs
- Cloudflare Workers 制限: https://developers.cloudflare.com/workers/platform/limits/
