# Fly.io 運用ファイル

## 目的
- 本番運用（Fly.io）で利用する設定ファイルと環境変数テンプレートを管理する。

## ファイル
- `infra/fly/apps.env.example`
  - アプリ名、fly.toml パス、内部接続先などを定義するテンプレート
- `infra/fly/client.fly.toml`
  - Remix client 用設定（公開 HTTP/HTTPS）
- `infra/fly/backend.fly.toml`
  - Go backend 用設定（Fly 内部通信）

## 使い方
1. `infra/fly/apps.env.example` を `infra/fly/apps.env` としてコピーし、実値へ変更する。
2. `scripts/production_preflight.sh` で事前チェックを行う。
3. `scripts/production_sync_fly_secrets.sh` で Secrets を反映する。
4. `scripts/deploy_production_fly.sh` でデプロイする。

## GitHub Actions 自動化
- Workflow: `.github/workflows/deploy-fly.yml`
- `main` push で `staging` へ自動デプロイする。
- `workflow_dispatch` で `staging` / `production` を手動選択できる。
- `production` は GitHub Environment の承認フロー設定を前提とする。

## Authentik について
- Authentik は本リポジトリの `infra/authentik/docker-compose.yml` でローカル運用を提供している。
- 本番で Fly.io 運用する場合は、別途 Authentik 専用の `fly.toml` を用意し、
  `infra/fly/apps.env` に `FLY_AUTHENTIK_APP` / `FLY_AUTHENTIK_CONFIG` を設定して同スクリプトから実行する。
- 具体的な運用手順は `docs/Phase2/production-operations.md` を参照する。
