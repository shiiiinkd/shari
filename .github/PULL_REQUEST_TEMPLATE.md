## 概要

<!-- このPRで何が変わるか、1〜2行で -->

## 背景・なぜ必要か

<!-- このPRがマージされないとどう困るか / どの要件・課題に対応するか -->

## 変更点

<!--
- 主要な変更を箇条書き
- 設計判断や採用しなかった選択肢があればここに
-->

## 影響範囲

- [ ] mobile（Expo）
- [ ] backend（Cloudflare Workers）
- [ ] packages/api（tRPC router 型）
- [ ] packages/shared（共通 schema）
- [ ] DB schema（migration を含む）
- [ ] 環境変数 / シークレット（追加・削除あり）
- [ ] CI / インフラ設定

## 動作確認

<!--
- どのコマンドで何を確認したか
- 例: `pnpm --filter @shari/backend dev` で /trpc/hello に curl して期待値
- 例: iOS Sim / Android Emu / 実機 で起動確認
-->

## チェックリスト

- [ ] `pnpm typecheck` がローカルでクリーン
- [ ] `pnpm lint` がローカルでクリーン
- [ ] `pnpm format:check` がローカルでクリーン
- [ ] `.env` / `.dev.vars` / シークレットを誤ってコミットしていない
- [ ] DB migration を含む場合、人間レビュー承認後に適用する旨を明記した
- [ ] 本番デプロイが必要な変更の場合、デプロイ手順を「動作確認」欄に書いた

## 関連

<!-- 関連 Issue / 設計ドキュメント / Slack スレッド等 -->
