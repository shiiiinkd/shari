# Worktree 並列開発ルール

複数の Claude Code インスタンスを git worktree で並列に動かして実装するときの共通ルール。
**作業を始める前に必ずこのファイルを読むこと。**

---

## 1. 配置と命名

- worktree は `../shari-worktrees/<branch-name>/` に配置（リポジトリ外に並べる）
- ブランチ名は英語 kebab-case で `<type>/<scope>-<desc>`
  - 例: `feat/mobile-summary-list` / `fix/backend-trpc-error` / `chore/shared-zod-bump`
- **1 worktree = 1 ブランチ = 1 タスク** を厳守

```bash
# 作成例
git worktree add ../shari-worktrees/feat-mobile-summary-list -b feat/mobile-summary-list origin/main
```

---

## 2. タスク分割の原則（衝突回避）

- パッケージ単位で分割するのが基本
  - `apps/mobile` / `apps/backend` / `packages/api` / `packages/shared`
- **同じファイルを触る作業は並列にしない**
- 各 worktree のスコープは「触っていいパス」を着手前に明示する

---

## 3. 並列禁止の組み合わせ（必ず直列化）

以下を変更する作業同士は **同時に走らせない**：

| 対象                          | 理由                                 |
| ----------------------------- | ------------------------------------ |
| `pnpm-lock.yaml`              | 依存追加・更新が必ずコンフリクトする |
| `supabase/migrations/`        | migration 番号が衝突する             |
| `packages/api` の tRPC router | 型シェアが壊れる / 互換性確認が必要  |
| 同じ `package.json`           | 依存・スクリプトが衝突する           |
| `worker-configuration.d.ts`   | wrangler 自動生成の上書きが起きる    |
| `wrangler.toml` / `app.json`  | 設定値の競合                         |

これらを含むタスクは **先にマージしてから他 worktree を rebase** する。

---

## 4. 同期ポイント

- **作業開始時**: `git fetch origin && git rebase origin/main`
- **他 worktree が main にマージされたら**: 速やかに rebase
- **長期 worktree**: 1 日 1 回以上 rebase
- コンフリクトしたら破棄せず、原因を確認してから解決（CLAUDE.md の破壊的操作ルールに従う）

---

## 5. マージ順序

依存方向に沿って下から上にマージする：

```
packages/shared  →  packages/api  →  apps/backend / apps/mobile
```

- migration / lockfile を含む PR を **最優先** で通す
- 1 PR = 1 worktree、複数タスクを混ぜない
- 共通基盤を変える PR は後続 worktree が rebase 待ちで止まるため、レビューも最優先

---

## 6. 完了後のクリーンアップ

マージ確認後に必ず実行：

```bash
git worktree remove ../shari-worktrees/<branch-name>
git branch -d <branch-name>
```

- 放置 worktree は週 1 で `git worktree list` で点検
- `git worktree prune` で死んだエントリを掃除

---

## 7. 各 Claude インスタンスへの引き継ぎ

worktree のルートに **`.claude-task.md`** を置く（`.gitignore` 対象推奨）。記載内容：

```markdown
# このインスタンスの担当タスク

- 何を実装するか（1〜2行）

# 触ってよいパス

- apps/mobile/src/features/summary/\*\*
- packages/shared/src/summary.ts

# 触ってはいけないパス

- packages/api/\*\* # 並走中の worktree-B が編集中
- supabase/migrations/\*\* # 今週は変更禁止

# 並走中の他 worktree

- ../shari-worktrees/feat-backend-summary-api（@担当者 / packages/api 担当）
```

各インスタンスは **作業前にこのファイルを必ず読み、スコープ外には触らない**。

---

## 8. 共通の絶対ルール（CLAUDE.md と同じ）

worktree 内であっても以下は **人間確認必須**：

- `git push` to main
- Supabase の DB migration 実行
- `wrangler deploy`（本番反映）
- `rm -rf` を含む削除

各 worktree で：

- 作業前に `pnpm typecheck` がクリーンか確認
- マージ前に `/code-review` スキルを回す
- コミットは `/commit` スキルで Conventional Commits（種別英語・本文日本語）

---

## 9. トラブル時の判断

- **lockfile コンフリクト**: 自分の worktree 側を捨てて main 側を採用 → `pnpm install` で再生成
- **migration 番号被り**: 後発側がリネーム（タイムスタンプを最新に振り直す）
- **tRPC router の型崩れ**: mobile 側の型エラーを確認してから API 変更を進める
- **どちらが先か迷ったら**: 共通基盤側（shared / api / migrations）を優先
