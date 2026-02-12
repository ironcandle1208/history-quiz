#!/usr/bin/env bash
set -euo pipefail

# 4. Client（Remix）を起動する一連の操作をまとめて実行する。
# 目的: 初期セットアップと起動手順を 1 コマンド化し、手順漏れを防ぐ。

# スクリプトの実行場所に依存しないよう、リポジトリルートへ移動する。
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# client 実行に必要な pnpm コマンドの存在を先に確認する。
if ! command -v pnpm >/dev/null 2>&1; then
  echo "エラー: pnpm コマンドが見つかりません。"
  exit 1
fi

# client/.env が未作成ならテンプレートから生成する。
if [ ! -f client/.env ]; then
  cp client/.env.example client/.env
  echo "client/.env を client/.env.example から作成しました。"
  echo "必要に応じて client/.env の OIDC / gRPC 設定値を編集してください。"
fi

echo "Client 依存関係をインストールします..."
cd client
pnpm install

echo "Client（Remix）を起動します..."
exec pnpm dev
