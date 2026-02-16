#!/usr/bin/env bash
set -euo pipefail

# production_preflight.sh は本番デプロイ前の必須チェックを実行する。
# 目的: コマンド不足・設定漏れ・設定ファイル欠落を事前に検知してデプロイ失敗を防ぐ。

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

# require_file は必須ファイルの存在を確認する。
require_file() {
  local file_path="$1"
  if [ ! -f "$file_path" ]; then
    echo "エラー: 必須ファイルが見つかりません: $file_path"
    exit 1
  fi
}

# validate_deploy_client_base_url は Cloudflare 公開URLとして妥当かを検証する。
validate_deploy_client_base_url() {
  local base_url="$1"

  if [[ ! "$base_url" =~ ^https:// ]]; then
    echo "エラー: DEPLOY_CLIENT_BASE_URL は https:// で開始する必要があります: $base_url"
    exit 1
  fi

  # 本番導線を Cloudflare 公開URLへ統一するため fly.dev を拒否する。
  if [[ "$base_url" == *".fly.dev"* ]]; then
    echo "エラー: DEPLOY_CLIENT_BASE_URL に fly.dev は指定できません: $base_url"
    echo "       Cloudflare 配下の公開URLを設定してください。"
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

# check_authentik_config_if_needed は Authentik デプロイ対象時のみ設定を検証する。
check_authentik_config_if_needed() {
  local deploy_authentik="${DEPLOY_AUTHENTIK:-false}"
  if [ "$deploy_authentik" != "true" ]; then
    return 0
  fi

  require_env "FLY_AUTHENTIK_APP"
  require_env "FLY_AUTHENTIK_CONFIG"
  require_file "$FLY_AUTHENTIK_CONFIG"
}

require_command "git"
require_command "flyctl"
require_command "psql"

load_apps_env

require_env "FLY_CLIENT_APP"
require_env "FLY_BACKEND_APP"
require_env "FLY_CLIENT_CONFIG"
require_env "FLY_BACKEND_CONFIG"
require_file "$FLY_CLIENT_CONFIG"
require_file "$FLY_BACKEND_CONFIG"
require_file "client/Dockerfile"
require_file "backend/Dockerfile"

# 本番で必要な環境変数（Secrets 反映時に利用）を事前に検証する。
require_env "DATABASE_URL"
require_env "SESSION_SECRET"
require_env "OIDC_ISSUER_URL"
require_env "OIDC_CLIENT_ID"
require_env "OIDC_CLIENT_SECRET"
require_env "OIDC_REDIRECT_URI"
require_env "BACKEND_GRPC_ADDRESS"
require_env "DEPLOY_CLIENT_BASE_URL"
validate_deploy_client_base_url "$DEPLOY_CLIENT_BASE_URL"

check_authentik_config_if_needed

./scripts/verify_migration_files.sh

echo "OK: 本番デプロイ前チェックが完了しました。"
