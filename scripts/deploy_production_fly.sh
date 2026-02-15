#!/usr/bin/env bash
set -euo pipefail

# deploy_production_fly.sh は Fly.io 本番デプロイ（migration + deploy + smoke）を一括実行する。
# 目的: 手順をコード化し、実行順のブレを減らす。

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# require_command は必須コマンドの存在を確認する。
require_command() {
  local command_name="$1"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "エラー: 必須コマンドが見つかりません: $command_name"
    exit 1
  fi
}

# require_env は必須環境変数が空でないことを確認する。
require_env() {
  local variable_name="$1"
  if [ -z "${!variable_name:-}" ]; then
    echo "エラー: 必須環境変数が未設定です: $variable_name"
    exit 1
  fi
}

# load_apps_env は Fly 用アプリ設定ファイルを読み込む。
load_apps_env() {
  local apps_env_path="infra/fly/apps.env"
  if [ ! -f "$apps_env_path" ]; then
    echo "エラー: $apps_env_path が存在しません。"
    echo "       infra/fly/apps.env.example をコピーして作成してください。"
    exit 1
  fi

  # shellcheck disable=SC1090
  source "$apps_env_path"
}

# deploy_app は指定アプリへ flyctl deploy を実行する。
deploy_app() {
  local app_name="$1"
  local config_path="$2"
  local dockerfile_path="$3"

  echo "デプロイ開始: $app_name"
  flyctl deploy \
    --remote-only \
    --app "$app_name" \
    --config "$config_path" \
    --dockerfile "$dockerfile_path"
  echo "デプロイ完了: $app_name"
}

require_command "flyctl"

# 事前チェックを先に通し、設定漏れのままデプロイしないようにする。
./scripts/production_preflight.sh
load_apps_env

# マイグレーション実行は既定で有効。必要なら RUN_MIGRATIONS=false で無効化できる。
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  require_command "psql"
  require_env "DATABASE_URL"
  ./scripts/apply_db_migrations.sh
fi

# 依存順に backend -> client をデプロイする。
deploy_app "$FLY_BACKEND_APP" "$FLY_BACKEND_CONFIG" "backend/Dockerfile"
deploy_app "$FLY_CLIENT_APP" "$FLY_CLIENT_CONFIG" "client/Dockerfile"

# Authentik は明示的に有効化した場合のみデプロイする。
if [ "${DEPLOY_AUTHENTIK:-false}" = "true" ]; then
  require_env "FLY_AUTHENTIK_APP"
  require_env "FLY_AUTHENTIK_CONFIG"
  # Authentik の Dockerfile は別管理される前提のため、ここでは --dockerfile を指定しない。
  flyctl deploy --remote-only --app "$FLY_AUTHENTIK_APP" --config "$FLY_AUTHENTIK_CONFIG"
fi

# 既定でスモークチェックを実行し、デプロイ直後の重大障害を即検知する。
if [ "${RUN_SMOKE_CHECK:-true}" = "true" ]; then
  ./scripts/production_smoke_check.sh
fi

echo "完了: 本番デプロイフローが終了しました。"
