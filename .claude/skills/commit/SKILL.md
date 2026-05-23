---
name: commit
description: shari プロジェクト用に Conventional Commits（種別=英語 / 本文=日本語）でコミットメッセージを生成する。実行前にステージ内容・差分・直近のログを確認し、scope を monorepo パッケージ名に整える。
---

# commit — shari 用コミットメッセージ生成

## 目的

`git diff --staged` の内容から、後から読み返したときに **「なぜそれを変えたか」が即座に分かる**コミットを作る。

## 形式

```
<type>(<scope>): <subject>

<body：日本語で「なぜ」を1〜3行>
```

- **type**（英語・小文字）: `feat` / `fix` / `docs` / `style` / `refactor` / `perf` / `test` / `chore` / `build` / `ci`
- **scope**（このリポジトリの正規値）: `mobile` / `backend` / `api` / `shared` / `infra` / `repo`
  - 2パッケージ以上にまたがるときは `repo` を使う
- **subject**: 日本語・命令形・50文字以内・末尾に句点を打たない
- **body**: 1行空けて記述。**何をしたか**ではなく**なぜそれが必要か**を書く。改行幅は72文字目安

## 実行手順

1. **並列で3コマンド実行**して状態を把握する:
   - `git status`（ステージ漏れ・想定外ファイルの混入を検知）
   - `git diff --staged`（コミット対象の中身）
   - `git log --oneline -10`（直近のメッセージ調子に合わせる）
2. ステージに `.env` / `.dev.vars` / `*.pem` / `*.key` 等のシークレットが混入していないか必ず確認。あれば**コミットせずユーザーに警告**する
3. 変更を上記 type / scope に分類。複数 type が混ざる場合は **コミット分割を提案**する（混ぜたままにしない）
4. 件名と本文を起案し、HEREDOC で `git commit -m` を実行
5. `git status` で結果確認

## scope の判定ルール

| 変更パス | scope |
| --- | --- |
| `apps/mobile/**` | `mobile` |
| `apps/backend/**` | `backend` |
| `packages/api/**` | `api` |
| `packages/shared/**` | `shared` |
| `wrangler.toml` / `turbo.json` / `pnpm-workspace.yaml` / `tsconfig.base.json` | `infra` |
| `CLAUDE.md` / `.claude/**` / `README.md` / `docs/**` | `repo` |
| 2つ以上にまたがる | `repo` |

## 良い例

```
feat(backend): YouTube字幕取得エンドポイントを追加

videoId を受け取り Transcript API を呼ぶ tRPC procedure を実装。
字幕なし動画は MVP 対象外なので 404 で返す方針。
```

```
fix(mobile): 共有インテントで起動時にURLが取れない不具合を解消

Expo 56 の Linking.getInitialURL() の戻り値型が null 含むため、
nullish チェックを追加。本番ビルドで再現していた起動直後の白画面を解消。
```

```
refactor(api): 入力 Zod schema を packages/shared に集約

mobile / backend で重複していた URL バリデーションを共通化。
将来 Web を足したときの整合性を確保するため。
```

## 避けるべき例

- ❌ `update files`（type/scope/具体性すべて欠如）
- ❌ `feat: 色々追加`（subject が抽象的）
- ❌ `fix(mobile): bug fix`（型と scope だけで中身ゼロ）
- ❌ 1コミットで mobile + backend + DB schema を同時変更（分割すべき）

## 禁止

- `git add -A` / `git add .` でのまとめステージ（シークレット混入リスク）
- `--no-verify` での hook スキップ（ユーザー明示指示がない限り）
- `--amend`（pre-commit 失敗時を含め、必ず**新規コミット**を作る）
