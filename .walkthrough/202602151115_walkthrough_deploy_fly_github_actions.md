# Walkthrough: Fly.io デプロイの GitHub Actions 自動化

## 実施日時
- 2026-02-15 11:15

## 背景
- `staging` と `production` のデプロイ運用を GitHub Actions で統一し、再現性を高める必要があった。
- 要件として、`staging` は自動、`production` は手動承認、同時デプロイ抑止（concurrency）を採用した。

## 変更内容
1. Workflow を追加
- `.github/workflows/deploy-fly.yml` を新規作成した。
- 振る舞い:
  - `main` push で `staging` 自動デプロイ
  - `workflow_dispatch` で `staging` / `production` を選択して手動デプロイ
  - `run_migrations` / `run_smoke_check` を入力値で切り替え
  - 環境ごとの `concurrency` で同時デプロイを防止

2. スモークチェックの環境変数名を汎用化
- `scripts/production_smoke_check.sh` を更新した。
- `DEPLOY_CLIENT_BASE_URL` を標準化し、旧 `PRODUCTION_CLIENT_BASE_URL` との後方互換を維持した。

3. ドキュメント更新
- `docs/Phase2/production-operations.md`
  - GitHub Actions 運用章（Workflow, Environment, 必須 Secrets/Variables）を追加
- `infra/fly/README.md`
  - 自動化運用の概要を追記
- `docs/tech.md`
  - Update Mechanism を Actions 運用方針に更新

## 実行フロー（Actions）
1. `infra/fly/apps.env` を CI 上で生成
2. `make production-preflight`
3. `make production-sync-secrets`
4. `make production-deploy`

## 動作確認
- `bash -n scripts/production_smoke_check.sh`
- `ruby -e "require 'yaml'; YAML.load_file('.github/workflows/deploy-fly.yml'); puts 'ok'"`

## 変更ファイル
- `.github/workflows/deploy-fly.yml`
- `scripts/production_smoke_check.sh`
- `docs/Phase2/production-operations.md`
- `infra/fly/README.md`
- `docs/tech.md`
- `.walkthrough/202602151115_walkthrough_deploy_fly_github_actions.md`
