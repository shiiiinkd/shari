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
  - **同じ論点**が scope をまたぐ場合のみ `repo` に束ねる
  - **論点が違う**なら scope を跨いでいても別コミットに分ける（後述の「分割の条件」参照）
- **subject**: 日本語・命令形・50文字以内・末尾に句点を打たない
- **body**: 1行空けて記述。**何をしたか**ではなく**なぜそれが必要か**を書く。改行幅は72文字目安

## Fast path（小さい変更はこれで終わる）

以下を**全て**満たすなら、status → stage → commit の3手で終わらせる:

- 変更が single type / single scope に収まる
- 触ったファイルが 3 以下
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
- ✅ **コンパイル可能性は維持**: 各コミット時点で `pnpm typecheck` がグリーンになるよう順序を組む

### サイズの目安（再点検トリガ）

- 1コミット **8 ファイル超**: 「これ本当に1論点か？」を立ち止まって再点検。複数論点の混在の可能性が高い
- 1コミット **300 LOC 超** (生成物・lockfile 除く): 同上
- 該当したら下の「典型分解パターン」を当ててみる

### 典型分解パターン（同じ機能内でも別 revert 単位になりがちな境界）

機能追加が「12 ファイル変更」になったら、以下の軸で割れないか確認する:

1. **抽象化導入 vs 実装追加**: interface / 型契約を入れる commit と、その実装クラスを足す commit は分けられる
2. **新規追加 vs 既存呼び出し点の差替**: 新サービスを足す commit と、既存の caller を新サービスに切り替える commit は別 revert 単位
3. **不要コードの削除**: 移行に伴う旧コード削除は、移行と別にしておくと revert 時に「削除だけ取り消す」ができる
4. **env / 型定義などスキャフォールド**: 新しい env を追加する commit と、それを使う実装 commit は分けても良い（ただし usage と離れすぎると意図が読みにくくなるので近接コミットに）
5. **観測性 (logging / onError / metrics)**: feature とは別 revert 単位

**束ねてよい例外（小変更のみ）:**

以下を**全て**満たすときに限り、複数要件を1コミットに束ねてよい:

- 変更ファイルが **合計 3 以下**
- どの変更も独立して revert する必然性がない（typo 修正・lint 整形・小さなリネーム等）
- いずれもシークレットを含まない

**コミット数の上限はない。** 論点の数だけ分ける。1セッションで 7〜8 コミットになるのも普通。逆に **「コミット数を減らすために束ねる」のは禁止**。

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

### 単一コミットの良い例

```
feat(backend): YouTube字幕取得エンドポイントを追加

videoId を受け取り Transcript API を呼ぶ tRPC procedure を実装。
字幕なし動画は MVP 対象外なので 404 で返す方針。
```

### 大きい変更の分割例（同一機能でも論点で割る）

「字幕取得基盤を Supadata に乗せ換え + LLM 抽象化 + YouTube サービス縮小」のような複合変更は、
論点ごとに分割する。同 PR にまとめて出すのは問題ないが、commit は別にする:

```
1. refactor(backend): tRPC サーバに onError ログを追加          (観測性)
2. feat(backend): LlmClient interface を導入し Claude 実装を切り出す (抽象化導入)
3. feat(backend): Supadata 経由の字幕取得 provider を追加         (新規実装)
4. refactor(api): YouTube サービスを oEmbed メタ取得のみに縮小     (既存呼び出し点差替 + 旧コード削除)
5. docs(repo): 字幕取得・LLM ロードマップを architecture.md に追記 (ドキュメント)
```

各コミット時点で `pnpm typecheck` がグリーンになるよう順序を組む（抽象化 → 実装 → caller 差替 の順が定石）。

## 避けるべき例

- ❌ `update files`（type/scope/具体性すべて欠如）
- ❌ `feat: 色々追加`（subject 抽象的）
- ❌ `fix(mobile): bug fix`（中身ゼロ）
- ❌ **複数論点の束ね**: 「abstraction 導入 + 実装追加 + 旧コード削除」を 1 コミットにまとめる（revert 単位が混ざる）
- ❌ **scope 跨ぎを理由にした安易な束ね**: 「backend と api に同時に触ったから repo で 1 つ」は短絡。論点が違うなら分ける

## 禁止

- `git add -A` / `git add .`（シークレット混入リスク）
- `--no-verify`（ユーザー明示指示なし）
- `--amend`（pre-commit 失敗時を含め、必ず**新規コミット**）
