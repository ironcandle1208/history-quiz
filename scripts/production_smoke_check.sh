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

# normalize_base_url は末尾スラッシュを除去した URL を返す。
normalize_base_url() {
  local url="$1"
  echo "${url%/}"
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

# assert_https_redirect は HTTP アクセスが HTTPS へリダイレクトされることを検証する。
assert_https_redirect() {
  local base_url="$1"
  local http_url
  local headers
  local status_code
  local location

  http_url="http://${base_url#https://}"
  headers="$(curl -sS -D - -o /dev/null "$http_url/")"
  status_code="$(echo "$headers" | awk 'NR==1 {print $2}')"
  location="$(echo "$headers" | tr -d '\r' | awk -F': ' 'tolower($1)=="location" {print $2; exit}')"

  if [[ ! "$status_code" =~ ^30[1278]$ ]]; then
    echo "エラー: HTTPS リダイレクトが無効です: status=$status_code url=$http_url/"
    exit 1
  fi

  if [[ ! "$location" =~ ^https:// ]]; then
    echo "エラー: リダイレクト先が HTTPS ではありません: location=$location"
    exit 1
  fi

  echo "OK: HTTPS リダイレクトを確認しました。 ($http_url/ -> $location)"
}

# assert_cache_bypass は Cloudflare 経由でキャッシュバイパス対象が HIT にならないことを検証する。
assert_cache_bypass() {
  local url="$1"
  local label="$2"
  local headers
  local cache_status

  headers="$(curl -sS -D - -o /dev/null "$url")"
  cache_status="$(echo "$headers" | tr -d '\r' | awk -F': ' 'tolower($1)=="cf-cache-status" {print toupper($2); exit}')"

  if [ -z "$cache_status" ]; then
    echo "エラー: $label ($url) の cf-cache-status が取得できません。Cloudflare 経由URLか確認してください。"
    exit 1
  fi

  if [ "$cache_status" = "HIT" ]; then
    echo "エラー: $label ($url) がキャッシュ HIT です。Bypass Cache ルールを確認してください。"
    exit 1
  fi

  echo "OK: $label ($url) の cf-cache-status=$cache_status"
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
require_env "DEPLOY_CLIENT_BASE_URL"

# SMOKE_CHECK_MODE は cloudflare（既定）または origin を受け付ける。
SMOKE_CHECK_MODE="${SMOKE_CHECK_MODE:-cloudflare}"
if [ "$SMOKE_CHECK_MODE" != "cloudflare" ] && [ "$SMOKE_CHECK_MODE" != "origin" ]; then
  echo "エラー: SMOKE_CHECK_MODE は cloudflare または origin を指定してください。"
  exit 1
fi

DEPLOY_CLIENT_BASE_URL="$(normalize_base_url "$DEPLOY_CLIENT_BASE_URL")"

# Fly 側の稼働状態を確認する。
flyctl status --app "$FLY_BACKEND_APP" >/dev/null
flyctl status --app "$FLY_CLIENT_APP" >/dev/null
echo "OK: Fly アプリ状態を確認しました。"

# Cloudflare 経由のスモークでは、HTTPS 強制とキャッシュバイパスも検証する。
if [ "$SMOKE_CHECK_MODE" = "cloudflare" ]; then
  assert_https_redirect "$DEPLOY_CLIENT_BASE_URL"
  assert_cache_bypass "$DEPLOY_CLIENT_BASE_URL/quiz" "クイズ画面（Bypass対象）"
  assert_cache_bypass "$DEPLOY_CLIENT_BASE_URL/login" "ログイン導線（Bypass対象）"
else
  echo "INFO: origin モードのため HTTPS リダイレクト/Cache 判定はスキップします。"
fi

# ユーザー主要導線を最小限チェックする。
assert_http_success "$DEPLOY_CLIENT_BASE_URL/" "トップページ"
assert_http_success "$DEPLOY_CLIENT_BASE_URL/quiz" "クイズ画面"
assert_http_success "$DEPLOY_CLIENT_BASE_URL/login" "ログイン導線"
assert_http_success "$DEPLOY_CLIENT_BASE_URL/questions/new" "作問画面導線"
assert_http_success "$DEPLOY_CLIENT_BASE_URL/me" "マイページ導線"

echo "完了: 本番スモークチェックが終了しました。"
