#!/usr/bin/env bash
set -euo pipefail

# production_sync_fly_secrets.sh は Fly.io 各アプリへ Secrets/環境変数を反映する。
# 目的: 手作業入力による設定漏れを減らし、反映手順を再現可能にする。

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

# sync_secret は指定環境変数の値を Fly Secrets に反映する。
sync_secret() {
  local app_name="$1"
  local variable_name="$2"
  local required="${3:-true}"
  local variable_value="${!variable_name:-}"

  if [ -z "$variable_value" ]; then
    if [ "$required" = "true" ]; then
      echo "エラー: $app_name に必要な環境変数が未設定です: $variable_name"
      exit 1
    fi
    return 0
  fi

  flyctl secrets set --stage --app "$app_name" "$variable_name=$variable_value" >/dev/null
  echo "OK: $app_name に $variable_name を反映しました。"
}

require_command "flyctl"
load_apps_env

require_env "FLY_CLIENT_APP"
require_env "FLY_BACKEND_APP"

# backend 用 Secrets
sync_secret "$FLY_BACKEND_APP" "DATABASE_URL"

# client 用 Secrets（秘密値・設定値を同一経路で反映し、運用を一本化する）
sync_secret "$FLY_CLIENT_APP" "SESSION_SECRET"
sync_secret "$FLY_CLIENT_APP" "OIDC_ISSUER_URL"
sync_secret "$FLY_CLIENT_APP" "OIDC_CLIENT_ID"
sync_secret "$FLY_CLIENT_APP" "OIDC_CLIENT_SECRET"
sync_secret "$FLY_CLIENT_APP" "OIDC_REDIRECT_URI"
sync_secret "$FLY_CLIENT_APP" "BACKEND_GRPC_ADDRESS"
sync_secret "$FLY_CLIENT_APP" "OIDC_SCOPES" "false"
sync_secret "$FLY_CLIENT_APP" "BACKEND_GRPC_TIMEOUT_MS" "false"
sync_secret "$FLY_CLIENT_APP" "BACKEND_GRPC_TLS" "false"
sync_secret "$FLY_CLIENT_APP" "GRPC_PROTO_ROOT" "false"

# Authentik は明示的に有効化した場合のみ反映する。
if [ "${DEPLOY_AUTHENTIK:-false}" = "true" ]; then
  require_env "FLY_AUTHENTIK_APP"
  sync_secret "$FLY_AUTHENTIK_APP" "AUTHENTIK_SECRET_KEY"
  sync_secret "$FLY_AUTHENTIK_APP" "AUTHENTIK_POSTGRES_PASSWORD"
  sync_secret "$FLY_AUTHENTIK_APP" "AUTHENTIK_POSTGRES_USER"
  sync_secret "$FLY_AUTHENTIK_APP" "AUTHENTIK_POSTGRES_DB"
  sync_secret "$FLY_AUTHENTIK_APP" "AUTHENTIK_BOOTSTRAP_EMAIL"
  sync_secret "$FLY_AUTHENTIK_APP" "AUTHENTIK_BOOTSTRAP_PASSWORD"
fi

echo "完了: Fly.io Secrets 反映が終了しました。"
