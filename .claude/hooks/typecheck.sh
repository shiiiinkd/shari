#!/usr/bin/env bash
# Claude のターン終了時に全パッケージの型チェックを走らせる。
# 型エラーがあれば stderr に出して気付けるようにするが、Stopループは作らない（exit 0）。

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT" || exit 0

# pnpm が無ければ何もしない
if ! command -v pnpm >/dev/null 2>&1; then
  exit 0
fi

OUTPUT="$(pnpm -s typecheck 2>&1)"
STATUS=$?

if [ "$STATUS" -ne 0 ]; then
  {
    echo ""
    echo "⚠️  型エラー検出（pnpm typecheck）"
    echo "------------------------------------------------------------"
    echo "$OUTPUT" | tail -n 40
    echo "------------------------------------------------------------"
    echo "次のターン開始前に修正してください。"
  } >&2
fi

exit 0
