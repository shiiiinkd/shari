# shari データモデル（Supabase / PostgreSQL）

> 最終更新: 2026-05-23
> ステータス: 初版（MVP想定・実装前）

このドキュメントは **「なぜそのスキーマか」** と **RLS方針** を残すことが目的。
実 schema は Supabase migration ファイル（`supabase/migrations/`）を真とし、ここでは設計判断だけ書く。

---

## 1. 設計の前提

- **すべての行は誰かの user_id に紐づく**（subscriptions / requests / 利用ログ）
  ただし **動画・要約・関連記事はキャッシュとして全ユーザー共有**（同じ動画を別ユーザーが要約しても再生成しない＝Claude API コスト削減）
- **RLS は全テーブルで有効化**。`anon` キーで参照する場合は明示的に SELECT ポリシーを許可
- **タイムスタンプは `timestamptz`** 統一、`created_at` / `updated_at` を持つテーブルは moddatetime トリガで自動更新
- **キャッシュ系テーブルは TTL 概念を持つ**: `fetched_at` をベースに後段で stale 判定（例: 関連記事は7日でリフレッシュ）

---

## 2. ER（概略）

```
auth.users (Supabase内蔵)
    │ 1:1
    ▼
profiles ───────────── subscriptions
    │ 1:N
    ▼
requests ─────► videos ──► transcripts
                  │
                  ├──► translations
                  ├──► summaries
                  └──► related_articles
```

---

## 3. テーブル定義（論理）

### 3.1 `profiles`

`auth.users` を 1:1 拡張。

| カラム         | 型          | 制約 / 備考                                                  |
| -------------- | ----------- | ------------------------------------------------------------ |
| `id`           | uuid        | PK、FK→`auth.users.id` ON DELETE CASCADE                     |
| `display_name` | text        | NULL可                                                       |
| `plan`         | text        | `'free'` / `'pro'` / `'team'`（default `'free'`、CHECK制約） |
| `created_at`   | timestamptz | default `now()`                                              |
| `updated_at`   | timestamptz | default `now()`、moddatetimeトリガ                           |

**RLS**: 自分の行のみ SELECT / UPDATE 可。INSERT は `handle_new_user()` トリガで自動。

### 3.2 `videos`（キャッシュ・全ユーザー共有）

YouTube 動画のメタデータキャッシュ。

| カラム           | 型          | 制約 / 備考                                                         |
| ---------------- | ----------- | ------------------------------------------------------------------- |
| `id`             | text        | PK、YouTube videoId（11文字、`[A-Za-z0-9_-]{11}` CHECK）            |
| `title`          | text        | NOT NULL                                                            |
| `channel_name`   | text        | NOT NULL                                                            |
| `channel_id`     | text        |                                                                     |
| `duration_sec`   | integer     | CHECK > 0                                                           |
| `published_at`   | timestamptz |                                                                     |
| `has_transcript` | boolean     | NOT NULL default false（字幕取得失敗時は false で記録、再試行抑制） |
| `fetched_at`     | timestamptz | default `now()`                                                     |

**RLS**: 認証済みユーザーは全行 SELECT 可。INSERT / UPDATE は service_role のみ。

### 3.3 `transcripts`（キャッシュ）

字幕本文。動画ごとに1行（言語別に必要になれば PK を `(video_id, language)` に拡張）。

| カラム        | 型          | 制約 / 備考                               |
| ------------- | ----------- | ----------------------------------------- |
| `video_id`    | text        | PK、FK→`videos.id` ON DELETE CASCADE      |
| `language`    | text        | NOT NULL（例: `'en'`, `'ja'`）            |
| `segments`    | jsonb       | NOT NULL（`[{ start, dur, text }]` 形式） |
| `text_length` | integer     | NOT NULL（要約コスト見積もり用）          |
| `fetched_at`  | timestamptz | default `now()`                           |

**RLS**: 認証済みユーザーは SELECT 可。INSERT / UPDATE は service_role のみ。
**インデックス**: `(language)`、`text_length` で範囲検索する場合は別途。

### 3.3.1 `translations`（キャッシュ・Claude 翻訳生成物）

字幕 → 日本語訳の中間キャッシュ。要約の前段に挟むことで、英語動画の要約品質を引き上げる。
直接 transcripts に「日本語訳列」を増やさず別テーブルに切る理由:

- transcripts は YouTube 由来の原文（多言語）のキャッシュであり、Claude 生成物（翻訳）と性質が違う。混ぜると「再生成すべきか」の判断軸（fetched_at vs prompt_version）が崩れる
- 翻訳プロンプトを将来差し替えたとき、`prompt_version` で自然にキャッシュ miss させたい（summaries と同じ運用）
- ターゲット言語が複数になっても PK 拡張でそのまま乗る

| カラム            | 型          | 制約 / 備考                                                                 |
| ----------------- | ----------- | --------------------------------------------------------------------------- |
| `video_id`        | text        | PK 構成、FK→`videos.id` ON DELETE CASCADE                                   |
| `source_language` | text        | PK 構成、NOT NULL（例: `'en'`、`transcripts.language` と一致）              |
| `target_language` | text        | PK 構成、NOT NULL（MVP は `'ja'` のみ）                                     |
| `translated_text` | text        | NOT NULL（翻訳済み本文。segments に戻さず生テキストで持つ＝要約用途のため） |
| `model`           | text        | NOT NULL（例: `'claude-opus-4-7'`）                                         |
| `prompt_version`  | text        | NOT NULL（翻訳プロンプト変更時の再生成判定用）                              |
| `input_tokens`    | integer     |                                                                             |
| `output_tokens`   | integer     |                                                                             |
| `created_at`      | timestamptz | default `now()`                                                             |

**PK**: `(video_id, source_language, target_language)` 複合キー。
同じ動画でも将来 ターゲット言語を増やせるよう余地を残す。
**CHECK 制約**: `source_language <> target_language`（同言語ペアは翻訳不要・無駄行防止）。呼び出し側でも事前に skip するが DB 側でも保険として弾く。
**RLS**: 認証済みユーザーは SELECT 可。INSERT / UPDATE は service_role のみ。
**インデックス**: PK で十分（lookup は `(video_id, source_language, target_language)` の完全一致）。

### 3.4 `summaries`（キャッシュ・Claude 生成物）

| カラム           | 型          | 制約 / 備考                                |
| ---------------- | ----------- | ------------------------------------------ |
| `id`             | uuid        | PK、default `gen_random_uuid()`            |
| `video_id`       | text        | FK→`videos.id` ON DELETE CASCADE           |
| `language`       | text        | NOT NULL default `'ja'`                    |
| `summary_md`     | text        | NOT NULL（Markdown）                       |
| `model`          | text        | NOT NULL（例: `'claude-opus-4-7'`）        |
| `prompt_version` | text        | NOT NULL（プロンプト変更時の再生成判定用） |
| `input_tokens`   | integer     |                                            |
| `output_tokens`  | integer     |                                            |
| `created_at`     | timestamptz | default `now()`                            |

**ユニーク**: `(video_id, language, prompt_version)`。これにより「同じ動画 × 同じプロンプトver」は1つに収束、コスト無駄使い防止。
**RLS**: 認証済みユーザーは SELECT 可。INSERT は service_role のみ。

### 3.5 `related_articles`（キャッシュ・Qiita / Zenn）

| カラム       | 型          | 制約 / 備考                       |
| ------------ | ----------- | --------------------------------- |
| `id`         | uuid        | PK、default `gen_random_uuid()`   |
| `video_id`   | text        | FK→`videos.id` ON DELETE CASCADE  |
| `source`     | text        | `'qiita'` / `'zenn'`（CHECK制約） |
| `url`        | text        | NOT NULL                          |
| `title`      | text        | NOT NULL                          |
| `score`      | numeric     |                                   |
| `fetched_at` | timestamptz | default `now()`                   |

**ユニーク**: `(video_id, url)`。
**RLS**: 認証済みユーザーは SELECT 可。INSERT は service_role のみ。

### 3.6 `requests`（利用ログ・Free プラン上限判定用）

| カラム       | 型          | 制約 / 備考                             |
| ------------ | ----------- | --------------------------------------- |
| `id`         | uuid        | PK                                      |
| `user_id`    | uuid        | FK→`auth.users.id` ON DELETE CASCADE    |
| `video_id`   | text        | FK→`videos.id`（キャッシュHitでも記録） |
| `cache_hit`  | boolean     | NOT NULL（コスト分析用）                |
| `created_at` | timestamptz | default `now()`                         |

**RLS**: 自分の行のみ SELECT 可。INSERT は service_role 経由（backend で書き込む）。
**インデックス**: `(user_id, created_at desc)` で月次集計を高速化。

### 3.7 `subscriptions`

Stripe 等の課金連携を入れたときに紐づける器。

| カラム                     | 型          | 制約 / 備考                              |
| -------------------------- | ----------- | ---------------------------------------- |
| `user_id`                  | uuid        | PK、FK→`auth.users.id` ON DELETE CASCADE |
| `plan`                     | text        | `'free'` / `'pro'` / `'team'`            |
| `provider`                 | text        | `'stripe'` 等                            |
| `provider_subscription_id` | text        |                                          |
| `current_period_end`       | timestamptz |                                          |
| `updated_at`               | timestamptz | default `now()`                          |

**RLS**: 自分の行のみ SELECT 可。INSERT / UPDATE は service_role のみ（webhookで更新）。

---

## 4. RLS 方針まとめ

| テーブル           | anon | authenticated（自分）    | service_role |
| ------------------ | ---- | ------------------------ | ------------ |
| `profiles`         | ✗    | SELECT / UPDATE 自分のみ | full         |
| `videos`           | ✗    | SELECT all               | full         |
| `transcripts`      | ✗    | SELECT all               | full         |
| `translations`     | ✗    | SELECT all               | full         |
| `summaries`        | ✗    | SELECT all               | full         |
| `related_articles` | ✗    | SELECT all               | full         |
| `requests`         | ✗    | SELECT 自分のみ          | full         |
| `subscriptions`    | ✗    | SELECT 自分のみ          | full         |

**重要**: キャッシュ系（videos / transcripts / translations / summaries / related_articles）への INSERT は **必ず backend（service_role）経由**。mobile から直接 INSERT させない（コスト・整合性の観点）。

---

## 5. インデックス（必須分のみ）

| テーブル           | インデックス                                  | 用途                   |
| ------------------ | --------------------------------------------- | ---------------------- |
| `requests`         | `(user_id, created_at desc)`                  | 月次集計・Free上限判定 |
| `summaries`        | `(video_id, language, prompt_version)` UNIQUE | キャッシュHit判定      |
| `related_articles` | `(video_id, url)` UNIQUE                      | 重複防止               |

それ以外は PK / FK の自動インデックスで MVP は十分。クエリパターンが固まってから追加。

---

## 6. 設計上の判断メモ

- **videos の PK を text(videoId) にした**: uuid を別途振らない。YouTube videoId は11文字で十分一意・短く・キャッシュキーとしてそのまま使える
- **要約は version 付きで複数保持**: プロンプト改善で再生成しても旧版を即削除しない。後で品質比較する余地を残す
- **request 記録は cache_hit を含む**: 「Claude を実際に呼んだ回数」と「ユーザー利用回数」を分離して可視化。コスト分析と Free 上限判定で参照するカラムが違う
- **summaries に user_id を持たせない**: 同じ動画・同じプロンプトverなら誰が要求しても同じ結果＝共有が最適。ユーザー別の付箋メモ等が必要になったら別テーブル `summary_notes(user_id, summary_id, body)` を切る
- **`profiles.plan` と `subscriptions.plan` の重複**: profiles 側は「現在の実効プラン（高速参照用）」、subscriptions 側は「課金状態の真実」。webhook で subscriptions が更新されたら profiles に反映する trigger を組む
- **`translations` の PK に `prompt_version` を含めない**: 翻訳は「言語ペア → 同じ意味の別言語」という安定写像で、要約ほどプロンプト差で揺れない。冪等性を優先して `(video_id, source_language, target_language)` の 3 列 PK とし、`prompt_version` は監査用メタとして列に保持する。翻訳プロンプトを破壊的に変えたい時は明示的に行を削除する運用

---

## 7. 未確定事項（MVP前に決める）

- [ ] `transcripts.segments` の上限サイズ（Postgres jsonb の実用上限・長尺動画の扱い）
- [ ] 要約の再生成 API を出すか、TTL 経過で自動再生成か
- [ ] `related_articles` のリフレッシュ間隔（7日仮置き）
- [ ] チャンネル単位の購読機能を入れた時の `channel_subscriptions` テーブル（Phase 2）

---

## 8. 関連

- [architecture.md](./architecture.md) — 全体設計
- [../CLAUDE.md](../CLAUDE.md) — DB migration は人間確認必須
- Supabase RLS: https://supabase.com/docs/guides/auth/row-level-security
