#!/usr/bin/env bash
set -euo pipefail

# 2. アプリDB（Postgres）を用意する一連の操作をまとめて実行する。
# 目的: 手動実行時のコマンド漏れを防ぎ、ローカル初期セットアップを再現可能にする。

# スクリプトの実行場所に依存しないよう、リポジトリルートへ移動する。
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# 必須コマンドの存在確認を先に行い、途中失敗を避ける。
if ! command -v docker >/dev/null 2>&1; then
  echo "エラー: docker コマンドが見つかりません。"
  exit 1
fi
if ! command -v psql >/dev/null 2>&1; then
  echo "エラー: psql コマンドが見つかりません。"
  exit 1
fi

# backend/.env が未作成ならテンプレートから生成する。
if [ ! -f backend/.env ]; then
  cp backend/.env.example backend/.env
  echo "backend/.env を backend/.env.example から作成しました。"
fi

echo "ローカルアプリDBを起動します..."
make db-up

# backend/.env の値を現在のシェルへ取り込み、psql に渡せるようにする。
set -a
source backend/.env
set +a

if [ -z "${DATABASE_URL:-}" ]; then
  echo "エラー: backend/.env に DATABASE_URL が設定されていません。"
  exit 1
fi

# Postgres の受け付け開始まで待機し、マイグレーションの接続失敗を防ぐ。
echo "Postgres の起動完了を待機します..."
for _ in $(seq 1 30); do
  if psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "select 1" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "select 1" >/dev/null 2>&1; then
  echo "エラー: Postgres に接続できませんでした。"
  exit 1
fi

# nullglob を有効化し、マイグレーションファイルが無い場合の誤実行を防ぐ。
shopt -s nullglob
migration_files=(backend/db/migrations/*.sql)
shopt -u nullglob

if [ "${#migration_files[@]}" -eq 0 ]; then
  echo "エラー: backend/db/migrations に SQL ファイルが見つかりません。"
  exit 1
fi

echo "マイグレーションを適用します..."
for f in "${migration_files[@]}"; do
  echo "  適用中: ${f}"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"
done

echo "完了: アプリDB起動とマイグレーション適用が終了しました。"
