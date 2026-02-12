#!/usr/bin/env bash
set -euo pipefail

# 3. Backend（Go / gRPC）を起動する一連の操作をまとめて実行する。
# 目的: 環境変数読み込み漏れを防ぎ、ローカル起動手順を 1 コマンド化する。

# スクリプトの実行場所に依存しないよう、リポジトリルートへ移動する。
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# backend 実行に必要な go コマンドの存在を先に確認する。
if ! command -v go >/dev/null 2>&1; then
  echo "エラー: go コマンドが見つかりません。"
  exit 1
fi

# backend/.env が未作成ならテンプレートから生成する。
if [ ! -f backend/.env ]; then
  cp backend/.env.example backend/.env
  echo "backend/.env を backend/.env.example から作成しました。"
fi

# backend/.env の値を現在のシェルへ取り込み、go run に渡せるようにする。
set -a
source backend/.env
set +a

# server 起動時に必須の DATABASE_URL を事前に検証する。
if [ -z "${DATABASE_URL:-}" ]; then
  echo "エラー: backend/.env に DATABASE_URL が設定されていません。"
  exit 1
fi

echo "Backend（Go / gRPC）を起動します..."
cd backend
exec go run ./cmd/server
