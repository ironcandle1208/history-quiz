#!/usr/bin/env bash
set -euo pipefail

# backend の Go テストを、ワークスペース配下のキャッシュ/一時ディレクトリで実行するスクリプト。
# 目的: 環境によってはデフォルトの Go キャッシュ先（例: ~/Library/Caches/go-build）に書き込めず失敗するため。

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

usage() {
  cat <<'USAGE'
使い方:
  ./scripts/test.sh                 # 通常のテスト（全パッケージ）
  ./scripts/test.sh --cover         # カバレッジ表示付き
  ./scripts/test.sh --coverprofile  # coverprofile を coverage.out に出力（HTML 生成方法も表示）

オプション:
  --cover         go test ./... -cover
  --coverprofile  go test ./... -coverprofile=coverage.out
USAGE
}

mode="${1:-}"
if [[ "${mode}" == "-h" || "${mode}" == "--help" ]]; then
  usage
  exit 0
fi
if [[ "${mode}" != "" && "${mode}" != "--cover" && "${mode}" != "--coverprofile" ]]; then
  echo "不明なオプションです: ${mode}" >&2
  usage >&2
  exit 2
fi

cd -- "${BACKEND_DIR}"
mkdir -p .gocache .gotmp

export GOCACHE="${BACKEND_DIR}/.gocache"
export GOTMPDIR="${BACKEND_DIR}/.gotmp"

case "${mode}" in
  "")
    go test ./...
    ;;
  "--cover")
    go test ./... -cover
    ;;
  "--coverprofile")
    go test ./... -coverprofile=coverage.out
    echo "coverage.out を HTML で確認する場合は以下を実行してください:"
    echo "  go tool cover -html=coverage.out -o coverage.html"
    ;;
esac

