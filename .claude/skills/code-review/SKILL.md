---
name: code-review
description: shari の差分を OWASP 観点とパフォーマンス観点で自己レビューする。tRPC / Zod / Cloudflare Workers / Expo の前提を踏まえ、file:line と修正案つきで指摘する。PR提出前に走らせて致命的な見落としを消すのが用途。
---

# code-review — shari 差分レビュー

## 目的

PR / コミット前に、人間レビュアーに渡す前段として **「マージしたら事故る」レベルの問題**を洗い出す。
スタイル指摘は Prettier / ESLint hook 側に任せ、このスキルは **正しさ・安全性・性能** に集中する。

## 実行手順

1. **対象差分を確定**する:
   - 引数で PR 番号や branch 指定があれば `gh pr diff <n>` / `git diff main...HEAD`
   - 指定がなければ `git diff main...HEAD`（カレントブランチ全体）
2. 変更ファイル一覧を取得し、ファイルごとに以下の **チェックリスト** に従って読む
3. 指摘は **重要度（critical / major / minor）+ file:line + 根拠 + 修正案** の形式で出力する
4. 最後に **総評**（マージ可否の所感）を1段落で添える

## チェックリスト

### A. セキュリティ（OWASP 観点・必ず全項目見る）

| カテゴリ | shari での具体例 |
| --- | --- |
| **シークレット混入** | `ANTHROPIC_API_KEY` / `SUPABASE_*` / `QIITA_TOKEN` がコード・テスト・ログにハードコードされていないか。`console.log` で env を吐いていないか |
| **入力検証** | tRPC procedure の `input(...)` に Zod schema が付いているか。`z.string()` 単独で URL を受けていないか（`.url()` を付けているか） |
| **YouTube URL 検証** | ユーザー入力をそのまま外部 API に渡していないか。videoId 抽出時に `^[A-Za-z0-9_-]{11}$` 等で正規化しているか（SSRF / 不正リクエスト防止） |
| **XSS** | mobile / 将来の web で、Claude 出力をそのまま `dangerouslySetInnerHTML` / `WebView` に渡していないか |
| **認可** | Supabase RLS を前提とした行参照になっているか。`service_role` キーをクライアント側に露出していないか |
| **エラーレスポンス** | 内部例外メッセージ・スタックトレースをそのまま `TRPCError` の `message` に入れて返していないか |
| **依存** | `package.json` 追加時、無名・低スター・型定義なしの新規依存が混じっていないか |

### B. パフォーマンス（Cloudflare Workers / Expo 観点）

| カテゴリ | チェック |
| --- | --- |
| **Workers CPU 制限** | 1リクエスト 50ms（無料枠）/ 30s（有料）上限。同期重処理・大きな JSON parse / 正規表現の暴走がないか |
| **Workers サブリクエスト数** | 1リクエスト最大 50 サブリクエスト。`Promise.all` で扇形展開していないか（Qiita / Zenn / Claude を直列で十分かを検討） |
| **冗長な再レンダー** | mobile で `useEffect` 依存配列の漏れ、毎レンダーで新規オブジェクト/関数を子に渡していないか |
| **N+1** | Supabase クエリでリスト取得後に各要素ごとに再フェッチしていないか。`select(..., relation(*))` で1発に出来ないか |
| **Claude API コスト** | 同じ字幕で複数回呼んでいないか。要約結果は Supabase にキャッシュされているか |
| **バンドルサイズ（mobile）** | 巨大ライブラリ（moment.js, lodash 全体 import 等）を入れていないか |

### C. 型安全 / 規約

- `any` / 暗黙の any が無いか（CLAUDE.md 禁止事項）
- tRPC の input/output 型が `packages/api` 経由で mobile に流れているか（手動で型を再宣言していないか）
- `packages/shared` で共通化すべきロジックが backend / mobile に重複していないか
- Workers で Node 専用 API（`fs`, `crypto.createHash`, `Buffer` の一部）を使っていないか

### D. テスト容易性 / 副作用

- 外部 API 呼び出しが直書きされず、注入可能な形になっているか
- ログ・キャッシュ・DB 書き込みなど副作用が tRPC procedure の本体にベタ書きで散らばっていないか

## 出力フォーマット

```
## 🔴 Critical
- apps/backend/src/routers/summary.ts:42
  - 根拠: ANTHROPIC_API_KEY を console.log している。Workers のログは Cloudflare ダッシュボードに残る
  - 修正案: ログから削除。デバッグ目的なら値の長さだけログする

## 🟡 Major
- apps/backend/src/routers/video.ts:18
  - 根拠: input が z.object({ url: z.string() })。任意文字列なので SSRF の余地あり
  - 修正案: z.string().url() に変更し、ホストを youtube.com / youtu.be に絞る検査を追加

## 🟢 Minor
- apps/mobile/src/screens/Result.tsx:55
  - 根拠: useMemo の依存配列に items が抜けている
  - 修正案: 依存に items を追加

## 総評
critical 1件あり、現状マージ不可。修正後に再レビュー推奨。
```

## オプション

- `--comment` フラグ付きで起動された場合: 上記指摘を `gh pr review --comment` 形式で実際にPRに投稿する（critical/major のみ）

## やらないこと

- スタイル（インデント・引用符・セミコロン）→ Prettier hook で自動整形済み
- 型エラー → Stop hook の `pnpm typecheck` で検出済み
- 命名の好み・コメントの追加要望 → ノイズになるので原則指摘しない
