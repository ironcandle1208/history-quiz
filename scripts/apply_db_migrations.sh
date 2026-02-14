#!/usr/bin/env bash
set -euo pipefail

# DATABASE_URL で指定された接続先に SQL マイグレーションを順次適用する。
# 適用前に verify_migration_files.sh を実行し、順序・命名の不整合を防止する。

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v psql >/dev/null 2>&1; then
  echo "エラー: psql コマンドが見つかりません。"
  exit 1
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "エラー: DATABASE_URL が未設定です。"
  exit 1
fi

./scripts/verify_migration_files.sh

shopt -s nullglob
migration_files=(backend/db/migrations/*.sql)
shopt -u nullglob

echo "マイグレーションを適用します..."
for migration_file in "${migration_files[@]}"; do
  echo "  適用中: ${migration_file}"
  # 各ファイルを単一トランザクションで実行し、途中失敗時の中途半端な反映を防ぐ。
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f "$migration_file"
done

echo "完了: マイグレーション適用が終了しました。"
