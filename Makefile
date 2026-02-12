.PHONY: help db-setup db-up db-down db-reset backend-run client-run

# アプリDB 用 docker compose ファイルのパスを定義する。
LOCAL_DB_COMPOSE_FILE := docker-compose.local-db.yml

# Docker Compose コマンドを変数化し、将来の差し替えを容易にする。
DOCKER_COMPOSE := docker compose

help:
	@echo "使い方:"
	@echo "  make db-setup # ローカルのアプリDB起動 + backend/.env 生成 + migration 適用"
	@echo "  make db-up    # ローカルのアプリDB(Postgres)を起動"
	@echo "  make db-down  # ローカルのアプリDB(Postgres)を停止（データ保持）"
	@echo "  make db-reset # ローカルのアプリDB(Postgres)を停止し、ボリュームも削除"
	@echo "  make backend-run # backend/.env 読み込み後に Go gRPC サーバーを起動"
	@echo "  make client-run  # client/.env 準備後に Remix 開発サーバーを起動"

db-setup:
	# アプリDBの起動、環境変数ファイル準備、マイグレーション適用を一括実行する。
	@./scripts/setup_local_app_db.sh

db-up:
	# ローカル開発用のアプリDBをバックグラウンド起動する。
	@$(DOCKER_COMPOSE) -f $(LOCAL_DB_COMPOSE_FILE) up -d

db-down:
	# ローカル開発用のアプリDBを停止し、データは保持する。
	@$(DOCKER_COMPOSE) -f $(LOCAL_DB_COMPOSE_FILE) down

db-reset:
	# ローカル開発用のアプリDBを停止し、ボリュームも削除して初期化する。
	@$(DOCKER_COMPOSE) -f $(LOCAL_DB_COMPOSE_FILE) down -v

backend-run:
	# backend 環境変数の読み込みと gRPC サーバー起動を一括実行する。
	@./scripts/run_backend_grpc_server.sh

client-run:
	# client 環境変数の準備と Remix 開発サーバー起動を一括実行する。
	@./scripts/run_client_remix_dev.sh
