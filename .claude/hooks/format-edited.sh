#!/usr/bin/env bash
# 直前に Edit/Write/MultiEdit で変更されたファイルを Prettier + ESLint で整形。
# どちらも未インストールならサイレントにスキップする（防御的実装）。

set -uo pipefail

# 標準入力に Claude Code が tool_input を JSON で渡してくる
INPUT="$(cat 2>/dev/null || true)"

FILE=""
if command -v jq >/dev/null 2>&1 && [ -n "$INPUT" ]; then
  FILE="$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null || true)"
fi

[ -z "$FILE" ] && exit 0
[ ! -f "$FILE" ] && exit 0

# 整形対象拡張子のみ処理
case "$FILE" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs|*.json|*.md|*.yml|*.yaml) ;;
  *) exit 0 ;;
esac

# リポジトリルートに移動（このスクリプトは .claude/hooks/ 配下）
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT" || exit 0

PRETTIER="$ROOT/node_modules/.bin/prettier"
ESLINT="$ROOT/node_modules/.bin/eslint"

# Prettier（インストール済みのときのみ）
if [ -x "$PRETTIER" ]; then
  "$PRETTIER" --write --log-level warn --ignore-unknown "$FILE" >/dev/null 2>&1 || true
fi

# ESLint --fix（JS/TS 系のみ・インストール済みのときのみ）
case "$FILE" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs)
    if [ -x "$ESLINT" ]; then
      "$ESLINT" --fix "$FILE" >/dev/null 2>&1 || true
    fi
    ;;
esac

exit 0
