.PHONY: help db-setup db-up db-down db-reset backend-run client-run production-preflight production-verify-migrations production-apply-migrations production-sync-secrets production-deploy production-smoke

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
	@echo "  make production-preflight   # 本番デプロイ前チェックを実行"
	@echo "  make production-verify-migrations # マイグレーションファイル検証を実行（手順4）"
	@echo "  make production-apply-migrations  # DATABASE_URL へマイグレーション適用（手順5a）"
	@echo "  make production-sync-secrets # Fly.io へ Secrets/設定値を反映"
	@echo "  make production-deploy      # migration + Fly.io デプロイ + スモークチェック"
	@echo "  make production-smoke       # 本番スモークチェックのみ実行"

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

production-preflight:
	# 本番デプロイ前に必須コマンド・設定ファイル・環境変数を検証する。
	@./scripts/production_preflight.sh

production-verify-migrations:
	# 本番適用前にマイグレーションファイルの命名規約と順序を検証する。
	@./scripts/verify_migration_files.sh

production-apply-migrations:
	# DATABASE_URL で指定されたDBへマイグレーションを順次適用する。
	@./scripts/apply_db_migrations.sh

production-sync-secrets:
	# Fly.io の各アプリへ Secrets/設定値を反映する。
	@./scripts/production_sync_fly_secrets.sh

production-deploy:
	# migration 適用、Fly.io デプロイ、スモークチェックを一括実行する。
	@./scripts/deploy_production_fly.sh

production-smoke:
	# デプロイ後の最小ヘルスチェックを実行する。
	@./scripts/production_smoke_check.sh
