#!/usr/bin/env bash
set -euo pipefail

# マイグレーションSQLの命名規約と順序を検証する。
# ルール: YYYYMMDDHHMMSS_description.sql（description は小文字英数字とアンダースコア）

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

shopt -s nullglob
migration_files=(backend/db/migrations/*.sql)
shopt -u nullglob

if [ "${#migration_files[@]}" -eq 0 ]; then
  echo "エラー: backend/db/migrations に SQL ファイルが見つかりません。"
  exit 1
fi

previous_timestamp=""
for migration_file in "${migration_files[@]}"; do
  filename="$(basename "$migration_file")"

  if [[ ! "$filename" =~ ^[0-9]{14}_[a-z0-9_]+\.sql$ ]]; then
    echo "エラー: マイグレーションファイル名が規約違反です: $filename"
    echo "期待形式: YYYYMMDDHHMMSS_description.sql"
    exit 1
  fi

  timestamp="${filename%%_*}"

  if [ -n "$previous_timestamp" ] && [ "$timestamp" -le "$previous_timestamp" ]; then
    echo "エラー: マイグレーションの順序が不正です: $filename"
    echo "前回タイムスタンプ: $previous_timestamp, 今回タイムスタンプ: $timestamp"
    exit 1
  fi

  previous_timestamp="$timestamp"
done

echo "OK: マイグレーションファイルの命名規約と順序を確認しました（${#migration_files[@]}件）。"
