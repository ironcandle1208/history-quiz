# Phase2 本番運用 Runbook（Fly.io / Neon / Secrets / Deploy）

## 目的
- 本番運用を属人化させず、同一手順で再現できる状態にする。
- Fly.io（Remix/Backend/Authentik）と Neon（アプリDB）の接続・デプロイ・障害対応を明文化する。

## 対象構成
- 公開Web: `client`（Remix, Fly.io）
- アプリAPI: `backend`（Go gRPC, Fly.io）
- 認証基盤: `authentik`（Fly.io。未導入時は `DEPLOY_AUTHENTIK=false` で除外）
- アプリDB: `Neon PostgreSQL`（`backend` から接続）

## 1. 事前準備

### 1.1 Fly 設定ファイル
1. `infra/fly/apps.env.example` を `infra/fly/apps.env` としてコピーする。
2. 以下を実運用値へ更新する。
- `FLY_CLIENT_APP`
- `FLY_BACKEND_APP`
- `FLY_CLIENT_CONFIG`
- `FLY_BACKEND_CONFIG`
- `BACKEND_GRPC_ADDRESS`（`<backend-app>.internal:50051`）

### 1.2 必須コマンド
- `flyctl`
- `psql`
- `curl`

## 2. シークレット管理ポリシー

### 2.1 原則
- 秘密値は Git に保存しない。
- 秘密値はシークレットマネージャー（または CI Secret Store）で一元管理し、実行時に環境変数で注入する。
- Fly.io への反映は `scripts/production_sync_fly_secrets.sh` のみを使う。

### 2.2 反映対象（最小セット）
- backend
  - `DATABASE_URL`（Neon 接続文字列、`sslmode=require`）
- client
  - `SESSION_SECRET`
  - `OIDC_ISSUER_URL`
  - `OIDC_CLIENT_ID`
  - `OIDC_CLIENT_SECRET`
  - `OIDC_REDIRECT_URI`
  - `BACKEND_GRPC_ADDRESS`
- authentik（`DEPLOY_AUTHENTIK=true` の場合のみ）
  - `AUTHENTIK_SECRET_KEY`
  - `AUTHENTIK_POSTGRES_PASSWORD`
  - `AUTHENTIK_POSTGRES_USER`
  - `AUTHENTIK_POSTGRES_DB`
  - `AUTHENTIK_BOOTSTRAP_EMAIL`
  - `AUTHENTIK_BOOTSTRAP_PASSWORD`

### 2.3 ローテーション手順
1. シークレットマネージャー側で新値を発行する。
2. デプロイ実行環境へ新値を注入する。
3. `make production-sync-secrets` を実行する。
4. `make production-deploy` で再デプロイする。
5. `make production-smoke` で正常性を確認する。

## 3. ネットワーク/接続方針
- `client` は公開（80/443）する。
- `backend` は Fly 内部通信専用（公開ポートなし）とし、`client` から `*.internal` 経由で接続する。
- `backend -> Neon` は TLS 必須（`DATABASE_URL` に `sslmode=require` を含める）。
- DB 接続障害時は以下順で確認する。
1. Fly 上の `backend` 起動状態
2. `DATABASE_URL` の誤設定（ホスト/資格情報/`sslmode`）
3. Neon 側の接続制限・障害情報

## 4. デプロイ手順（標準）

### 4.1 実行前に環境変数を読み込む
- 例: CI では Secret Store から注入、手元実行では一時 export。

### 4.2 標準フロー
```bash
make production-preflight
make production-sync-secrets
make production-deploy
```

`make production-deploy` の内部実行順:
1. 前提チェック（`production_preflight.sh`）
2. DB migration 適用（既定 `RUN_MIGRATIONS=true`）
3. backend デプロイ
4. client デプロイ
5. スモークチェック（既定 `RUN_SMOKE_CHECK=true`）

### 4.3 Authentik も同時デプロイする場合
```bash
export DEPLOY_AUTHENTIK=true
make production-sync-secrets
make production-deploy
```

補足:
- `FLY_AUTHENTIK_APP` / `FLY_AUTHENTIK_CONFIG` が `infra/fly/apps.env` に必要。
- Authentik 専用 `fly.toml` は本番環境で別途管理する。

## 5. 障害時の切り戻し

### 5.1 アプリ切り戻し（Fly.io Release rollback）
1. 直前の安定リリースを確認する。
```bash
flyctl releases --app <app-name>
```
2. 対象リリースへ切り戻す。
```bash
flyctl releases rollback <release-id> --app <app-name>
```
3. `make production-smoke` で復旧確認する。

### 5.2 DB 障害時（Neon restore）
1. 影響範囲確定まで書き込みを停止する。
2. Neon の復元ポイントから復元先ブランチ/インスタンスを作成する。
3. 復元先の接続文字列へ `DATABASE_URL` を更新し、`make production-sync-secrets` を実行する。
4. `backend` を再デプロイし、スモークテストを実施する。
5. 原因に対する `forward fix` migration を準備し、再発防止策を記録する。

## 6. 定期運用チェックリスト
- [ ] Fly.io のアプリ状態を週次確認した
- [ ] Fly.io の usage / billing を週次確認した
- [ ] 月次予算に対する消化率と増加率（前週比）を確認した
- [ ] Neon のバックアップ/復元ポイントを確認した
- [ ] Secrets のローテーション期限を確認した
- [ ] Runbook 通りにステージング相当リハーサルを実施した
- [ ] 実施ログ（実施者・日時・結果）を残した

## 7. 自動化スクリプト一覧
- `scripts/production_preflight.sh`
  - 依存コマンド、環境変数、設定ファイル、migration命名の事前チェック
- `scripts/production_sync_fly_secrets.sh`
  - Fly.io への Secrets/設定値反映
- `scripts/deploy_production_fly.sh`
  - migration + deploy + smoke の一括実行
- `scripts/production_smoke_check.sh`
  - デプロイ後の主要導線ヘルスチェック

## 8. GitHub Actions 自動デプロイ

### 8.1 Workflow
- ファイル: `.github/workflows/deploy-fly.yml`
- `push`（`main`）:
  - `staging` 環境へ自動デプロイ
- `workflow_dispatch`:
  - `target_environment=staging|production` を手動選択してデプロイ
  - `run_migrations` / `run_smoke_check` を切り替え可能

### 8.2 Environment（GitHub）設定
- Environment は `staging` / `production` を作成する。
- `production` には `required reviewers` を設定し、承認なしで実行できないようにする。
- `concurrency` は workflow 内で環境ごとに分離しており、同一環境への同時デプロイを防止する。

### 8.3 必須 Secrets（Environment secrets）
- `FLY_API_TOKEN`
- `DATABASE_URL`
- `SESSION_SECRET`
- `OIDC_CLIENT_SECRET`
- `AUTHENTIK_SECRET_KEY`（Authentik を deploy する場合）
- `AUTHENTIK_POSTGRES_PASSWORD`（Authentik を deploy する場合）
- `AUTHENTIK_BOOTSTRAP_PASSWORD`（Authentik を deploy する場合）

### 8.4 必須 Variables（Environment variables）
- `FLY_CLIENT_APP`
- `FLY_BACKEND_APP`
- `FLY_CLIENT_CONFIG`（例: `infra/fly/client.fly.toml`）
- `FLY_BACKEND_CONFIG`（例: `infra/fly/backend.fly.toml`）
- `BACKEND_GRPC_ADDRESS`（例: `<backend-app>.internal:50051`）
- `OIDC_ISSUER_URL`
- `OIDC_CLIENT_ID`
- `OIDC_REDIRECT_URI`
- `DEPLOY_CLIENT_BASE_URL`（スモークチェック対象URL）

### 8.5 任意 Variables（必要時のみ）
- `OIDC_SCOPES`
- `BACKEND_GRPC_TIMEOUT_MS`
- `BACKEND_GRPC_TLS`
- `GRPC_PROTO_ROOT`
- `DEPLOY_AUTHENTIK`
- `FLY_AUTHENTIK_APP`
- `FLY_AUTHENTIK_CONFIG`
- `AUTHENTIK_POSTGRES_USER`
- `AUTHENTIK_POSTGRES_DB`

## 9. Fly.io コスト管理

### 9.1 主要なコスト増大リスク
- 常時起動設定による固定費の高止まり
  - `client` は `min_machines_running = 1`
  - `backend` は `auto_stop_machines = "off"` かつ `min_machines_running = 1`
- `main` push 起点の staging 自動デプロイによる remote build 回数増加
- migration / smoke の既定有効によるデプロイ付随コスト増加
- `DEPLOY_AUTHENTIK=true` 運用時のアプリ増分固定費
- 予算アラート未整備時の検知遅延

### 9.2 コスト対応方針
1. 監視とアラートを先に整備する（予算と増加率を可視化する）。
2. staging から段階的に常時起動設定を見直し、固定費を最適化する。
3. 自動デプロイ条件を必要最小限にし、デプロイ回数を抑制する。
4. `run_migrations` / `run_smoke_check` を変更種別で使い分け、不要実行を削減する。
5. Authentik は稼働要否を環境ごとに明示し、不要環境では停止または分離運用する。

### 9.3 週次モニタリング手順
1. Fly.io ダッシュボードで `Usage` / `Billing` を確認し、前週比と月次累計を記録する。
2. 監視ログに以下を残す。
  - 週次コスト
  - 月次累計
  - 前週比
  - デプロイ回数
3. 以下の閾値で判定する。
  - 警告: 前週比 `+20%` 超、または月次予算消化率 `80%` 超
  - 重大: 月次予算超過見込み（予測 `100%` 超）
4. 閾値超過時はエスカレーションを実施する。
  - `production` 責任者へ即時共有
  - staging の自動デプロイ頻度を一時的に抑制
  - staging の `min_machines_running` / `auto_stop_machines` 見直しを優先実施
  - 不要な migration / smoke 実行を停止
