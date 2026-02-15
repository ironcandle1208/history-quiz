#!/usr/bin/env bash
set -euo pipefail

# production_smoke_check.sh は本番デプロイ後の最小ヘルスチェックを実行する。
# 目的: エンドユーザー導線（トップ・クイズ・ログイン）が生きているかを即時確認する。

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

# assert_http_success は URL が HTTP 2xx/3xx で応答することを検証する。
assert_http_success() {
  local url="$1"
  local label="$2"
  local status_code
  status_code="$(curl -L -s -o /dev/null -w "%{http_code}" "$url")"

  if [[ "$status_code" =~ ^2[0-9][0-9]$ ]] || [[ "$status_code" =~ ^3[0-9][0-9]$ ]]; then
    echo "OK: $label ($url) status=$status_code"
    return 0
  fi

  echo "エラー: $label ($url) が異常ステータスです: $status_code"
  exit 1
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

require_command "curl"
require_command "flyctl"

load_apps_env
require_env "FLY_CLIENT_APP"
require_env "FLY_BACKEND_APP"

# DEPLOY_CLIENT_BASE_URL は staging/production 共通で使う公開URL。
# 後方互換のため、旧変数 PRODUCTION_CLIENT_BASE_URL も許可する。
if [ -z "${DEPLOY_CLIENT_BASE_URL:-}" ] && [ -n "${PRODUCTION_CLIENT_BASE_URL:-}" ]; then
  DEPLOY_CLIENT_BASE_URL="$PRODUCTION_CLIENT_BASE_URL"
fi
require_env "DEPLOY_CLIENT_BASE_URL"

# Fly 側の稼働状態を確認する。
flyctl status --app "$FLY_BACKEND_APP" >/dev/null
flyctl status --app "$FLY_CLIENT_APP" >/dev/null
echo "OK: Fly アプリ状態を確認しました。"

# ユーザー主要導線を最小限チェックする。
assert_http_success "$DEPLOY_CLIENT_BASE_URL/" "トップページ"
assert_http_success "$DEPLOY_CLIENT_BASE_URL/quiz" "クイズ画面"
assert_http_success "$DEPLOY_CLIENT_BASE_URL/login" "ログイン導線"

echo "完了: 本番スモークチェックが終了しました。"
