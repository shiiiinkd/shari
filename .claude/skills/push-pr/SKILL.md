---
name: push-pr
description: ブランチ安全検証 → 必要なら新ブランチ作成 → push → PR作成を一気通貫で行う。mainへの直接pushを防ぎ、gh CLIでPRを自動生成する。実装完了後に使う。
---

# push-pr — ブランチ検証・push・PR作成

## 目的

実装完了後に「pushしてPR出す」という繰り返し作業を自動化しながら、
**mainへの誤push・シークレット混入・命名違反** を防ぐ。

## 実行手順

### Step 1: 状態把握（並列実行）

```bash
git branch --show-current
git status
git log main..HEAD --oneline
```

### Step 2: ブランチ安全検証

現在のブランチを確認し、以下のルールに従う。

#### mainにいる場合 → 必ず新ブランチを作成してから進む

差分の内容から適切なブランチ名を1つ提案し、ユーザーに確認してから
`git checkout -b <branch>` を実行する。

ブランチ命名規則（/commit skillのscopeと合わせる）:

| 種別             | prefix      | 例                         |
| ---------------- | ----------- | -------------------------- |
| 新機能           | `feat/`     | `feat/url-input-screen`    |
| バグ修正         | `fix/`      | `fix/clipboard-detection`  |
| リファクタリング | `refactor/` | `refactor/summary-router`  |
| ドキュメント     | `docs/`     | `docs/update-architecture` |
| インフラ・設定   | `chore/`    | `chore/add-grill-me-skill` |

#### feat/・fix/・refactor/・docs/・chore/ 以外のprefixの場合

「このブランチ名はプロジェクト規約外です。続行しますか？」と確認を求める。

### Step 3: シークレット混入チェック

`git diff main..HEAD` を確認し、以下が含まれていないかチェックする。

- `.env` / `.dev.vars` の実値
- `ANTHROPIC_API_KEY` / `SUPABASE_*` / `QIITA_TOKEN` の直書き
- APIキー・トークン・パスワードのハードコード

**検出した場合は即座に中断し、ユーザーに警告する。pushは行わない。**

### Step 4: push

```bash
git push origin <branch-name>
```

mainへのpushは**いかなる理由があっても実行しない**。

### Step 5: PR作成

`git log main..HEAD` と `git diff main..HEAD` からPRを生成する。

#### PRタイトル

/commit skillと同じConventional Commits形式:

`<type>(<scope>): <日本語で変更内容を50文字以内>`

#### PR本文

`.github/PULL_REQUEST_TEMPLATE.md` の形式に従い日本語で生成する。

```markdown
## 概要

<!-- 1〜2行で何が変わるか -->

## 背景・なぜ必要か

<!-- この変更がないとどう困るか -->

## 変更点

- 主要な変更を箇条書き
- 設計上の判断があれば記載

## 影響範囲

- [ ] mobile（Expo）
- [ ] backend（Cloudflare Workers）
- [ ] packages/api（tRPC router 型）
- [ ] packages/shared（共通 schema）
- [ ] DB schema（migration を含む）
- [ ] 環境変数 / シークレット
- [ ] CI / インフラ設定

## 動作確認

<!-- 確認したコマンドと結果 -->

## チェックリスト

- [ ] pnpm typecheck がクリーン
- [ ] pnpm lint がクリーン
- [ ] シークレットをコミットしていない
```

生成後、以下で実行する:

```bash
gh pr create \
  --title "<生成したタイトル>" \
  --body "<生成した本文>" \
  --base main
```

### Step 6: 結果確認

作成されたPRのURLを表示する。

---

## Fast path（差分が小さい場合）

以下を全て満たすなら、ブランチ確認とシークレットチェックだけ行い
提案なしで即pushとPR作成に進む:

- mainにいない
- 命名規約に沿ったブランチ名
- 変更ファイルが5以下
- シークレット混入なし

## やってはいけないこと

- `git push origin main`（絶対禁止）
- `--force` / `--force-with-lease`（ユーザーの明示指示なし）
- シークレット検出後のpush続行
- ユーザー確認なしのブランチ名変更
- `--no-verify` の使用
