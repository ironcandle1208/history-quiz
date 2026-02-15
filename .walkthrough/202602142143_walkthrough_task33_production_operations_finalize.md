# Task33: 本番運用詳細（Fly.io/Neon/Secrets/Deploy）の確定とコード化

## 実施日時
- 2026-02-14 21:43

## 背景
- `docs/tasks.md` の未完了タスク 33 を完了する必要があった。
- `docs/tech.md` の Known Limitations に、本番運用（Fly.io/Neon/Secrets/Deploy）の未確定項目が残っていた。

## 変更内容
1. 本番 Runbook を新規作成
- `docs/Phase2/production-operations.md` を新規作成した。
- 以下を明記した。
  - Secrets 管理ポリシー（保存・反映・ローテーション）
  - Fly.io への標準デプロイ手順（preflight → secrets sync → deploy）
  - Neon 接続方針（`sslmode=require`）
  - 障害時切り戻し（Fly リリース rollback / Neon restore）

2. デプロイ手順をコード化
- `scripts/production_preflight.sh` を新規作成した。
  - 必須コマンド、環境変数、設定ファイル、migration命名を検証
- `scripts/production_sync_fly_secrets.sh` を新規作成した。
  - backend/client（必要に応じて authentik）へ Secrets を一括反映
- `scripts/deploy_production_fly.sh` を新規作成した。
  - migration 適用、Fly deploy、スモークチェックを順序固定で実行
- `scripts/production_smoke_check.sh` を新規作成した。
  - 本番 URL の主要導線を簡易検証

3. Fly 運用テンプレートを追加
- `infra/fly/apps.env.example` を追加した。
- `infra/fly/client.fly.toml` / `infra/fly/backend.fly.toml` を追加した。
- `infra/fly/README.md` を追加し、設定ファイルの使い方を整理した。

4. 本番コンテナ定義を追加
- `client/Dockerfile` を追加した。
  - Remix build 生成物と `proto` を同梱し、`GRPC_PROTO_ROOT=/app/proto` で実行
- `backend/Dockerfile` を追加した。
  - Go gRPC サーバーをマルチステージビルドで実行
- `.dockerignore` を追加した。
  - 不要ファイル（`.git`、`node_modules`、生成物）の転送を抑制

5. 既存ドキュメント/導線を更新
- `Makefile` に以下ターゲットを追加した。
  - `production-preflight`
  - `production-sync-secrets`
  - `production-deploy`
  - `production-smoke`
- `docs/tech.md` を更新し、更新メカニズムと Runbook 参照を確定内容へ反映した。
- `docs/tasks.md` の Task33 を完了（`[x]`）に更新した。

## 設計上の意図
- 「手順書だけ」ではなく、同じ順序を再現できるスクリプトを提供して運用ブレを減らす方針を採用した。
- backend を内部通信専用とし、公開面を client に集約して攻撃面を抑える方針を明確化した。
- DB運用は既存の migration スクリプト資産を流用し、本番フローへ統合した。

## 動作確認
- `bash -n scripts/production_preflight.sh scripts/production_sync_fly_secrets.sh scripts/deploy_production_fly.sh scripts/production_smoke_check.sh`
- `bash -n scripts/verify_migration_files.sh scripts/apply_db_migrations.sh`

## 変更ファイル
- `docs/Phase2/production-operations.md`
- `scripts/production_preflight.sh`
- `scripts/production_sync_fly_secrets.sh`
- `scripts/deploy_production_fly.sh`
- `scripts/production_smoke_check.sh`
- `infra/fly/apps.env.example`
- `infra/fly/client.fly.toml`
- `infra/fly/backend.fly.toml`
- `infra/fly/README.md`
- `client/Dockerfile`
- `backend/Dockerfile`
- `.dockerignore`
- `Makefile`
- `docs/tech.md`
- `docs/tasks.md`
- `.walkthrough/202602142143_walkthrough_task33_production_operations_finalize.md`
