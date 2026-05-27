---
name: commit
description: shari プロジェクト用に Conventional Commits（種別=英語 / 本文=日本語）でコミットメッセージを生成する。実行前にステージ内容・差分・直近のログを確認し、scope を monorepo パッケージ名に整える。
---

# commit — shari 用コミットメッセージ生成

## 目的

`git diff` の内容から、後から読み返したときに **「なぜそれを変えたか」が即座に分かる**コミットを作る。

## 形式

```
<type>(<scope>): <subject>

<body：日本語で「なぜ」を1〜3行>
```

- **type**（英語・小文字）: `feat` / `fix` / `docs` / `style` / `refactor` / `perf` / `test` / `chore` / `build` / `ci`
- **scope**（このリポジトリの正規値）: `mobile` / `backend` / `api` / `shared` / `infra` / `repo`
  - 2つ以上にまたがるときは `repo`（分割しない判断と矛盾しない）
- **subject**: 日本語・命令形・50文字以内・末尾に句点を打たない
- **body**: 1行空けて記述。**何をしたか**ではなく**なぜそれが必要か**を書く。改行幅は72文字目安

## Fast path（小さい変更はこれで終わる）

以下を**全て**満たすなら、status → stage → commit の3手で終わらせる:

- 変更が single type / single scope に収まる
- 触ったファイルが 5 以下
- シークレット系（`.env` / `.dev.vars` / `*.pem` / `*.key`）が含まれていない

満たさないときだけ下の「通常手順」へ。

## 通常手順

1. 状態把握（並列実行）:
   - `git status`
   - `git diff`（unstaged の全変更。`--staged` ではない）
   - `git log --oneline -10`（直近スタイル合わせ。**同セッションで既に確認済みなら省略**）
2. シークレット混入チェック。あれば**コミットせずユーザーに警告**
3. 分割判定（**デフォルトは要件単位で分ける**。下の「分割の条件」参照）
4. `git add <files>` で個別ステージ → HEREDOC で `git commit -m`
5. `git status` で結果確認

## 分割の条件

**デフォルト: 要件（論点）が違うなら分ける。** 判断基準は「**レビュアーが別の論点として読みたい粒度か**」。そうなら分ける。

具体ルール:

- ✅ **同じ type / 同じ scope でも、要件が違うなら分ける**（例: `feat(mobile)` の画面追加と、別機能の `feat(mobile)` ボタン追加は別コミット）
- ❌ **type が違うだけ**を理由には分けない（同一要件で `feat` + `test` + `docs` がまとまっているのはむしろ望ましい）
- ✅ シークレット隔離: 機微変更は独立コミット
- ✅ revert 単位: 将来 cherry-pick / revert したい論点境界が明確なら分ける

**束ねてよい例外（小変更のみ）:**

以下を**全て**満たすときに限り、複数要件を1コミットに束ねてよい:

- 変更ファイルが **合計 5 以下**
- どの変更も独立して revert する必然性がない（typo 修正・lint 整形・小さなリネーム等）
- いずれもシークレットを含まない

**上限:** 1セッションで作る分割コミットは **5 まで**。超えるなら要件のまとめ方を再考し、関連が強いものを統合する（無理に `repo` で束ねるよりも、要件粒度を見直す）。

## scope の判定

| 変更パス                                                                                     | scope     |
| -------------------------------------------------------------------------------------------- | --------- |
| `apps/mobile/**`                                                                             | `mobile`  |
| `apps/backend/**`                                                                            | `backend` |
| `packages/api/**`                                                                            | `api`     |
| `packages/shared/**`                                                                         | `shared`  |
| `wrangler.toml` / `turbo.json` / `pnpm-workspace.yaml` / `tsconfig.base.json` / `.github/**` | `infra`   |
| `CLAUDE.md` / `.claude/**` / `README.md` / `docs/**`                                         | `repo`    |
| 2つ以上にまたがる                                                                            | `repo`    |

## 例

```
feat(backend): YouTube字幕取得エンドポイントを追加

videoId を受け取り Transcript API を呼ぶ tRPC procedure を実装。
字幕なし動画は MVP 対象外なので 404 で返す方針。
```

## 避けるべき例

- ❌ `update files`（type/scope/具体性すべて欠如）
- ❌ `feat: 色々追加`（subject 抽象的）
- ❌ `fix(mobile): bug fix`（中身ゼロ）
- ❌ type が違うだけで mobile / backend を別コミットに分ける（scope 跨ぎは `repo` で束ねる）

## 禁止

- `git add -A` / `git add .`（シークレット混入リスク）
- `--no-verify`（ユーザー明示指示なし）
- `--amend`（pre-commit 失敗時を含め、必ず**新規コミット**）
