# security.md 残タスク解消（ヘッダ/ボディ上限/Flyコスト運用）

## 実施日時
- 2026-02-16 21:30（ローカル）

## 背景
- `docs/security.md` の未完了項目として、アプリ側セキュリティ2件と Fly.io コスト運用5件が残っていた。
- 指示に基づき、実装・CI・運用ドキュメントの更新まで含めて解消した。

## 変更内容
### 1. 共通セキュリティヘッダ導入
- `client/app/entry.server.tsx`
  - `applySecurityHeaders` を追加。
  - `Content-Security-Policy`、`X-Frame-Options`、`X-Content-Type-Options`、`Referrer-Policy`、`Permissions-Policy`、`Strict-Transport-Security` を全SSRレスポンスに付与。

### 2. HTTP ボディサイズ上限（Content-Length）導入
- `client/app/services/request-size.server.ts`（新規）
  - `assertRequestContentLengthWithinLimit` を追加。
  - 不正ヘッダは `400`、上限超過は `413` を返す共通処理を実装。
- `client/app/routes/quiz.tsx`
  - action で 8KB 上限を適用。
- `client/app/routes/questions.new.tsx`
  - action で 32KB 上限を適用。
- `client/app/routes/questions.$id.edit.tsx`
  - action で 32KB 上限を適用。
- `client/app/tests/integration/request-size.server.integration.test.ts`（新規）
  - 正常系 / `413` / `400` を追加検証。

### 3. Fly.io コスト運用の最適化
- `infra/fly/client.fly.toml`
  - `min_machines_running=0` に変更（既定をコスト最適化）。
- `infra/fly/backend.fly.toml`
  - `auto_stop_machines="stop"`、`min_machines_running=0` に変更。
- `infra/fly/client.production.fly.toml`（新規）
  - production 常時起動用設定を追加（`min_machines_running=1`）。
- `infra/fly/backend.production.fly.toml`（新規）
  - production 常時起動用設定を追加（`auto_stop_machines="off"`, `min_machines_running=1`）。
- `infra/fly/apps.env.example`
  - staging/production の設定使い分け方針を追記。

### 4. CI デプロイポリシー最適化
- `.github/workflows/deploy-fly.yml`
  - push トリガー対象を必要ファイルに限定。
  - test/Walkthrough 変更は自動デプロイ対象外に設定。
  - `resolve-staging-deploy-flags` ジョブを追加し、変更ファイルに応じて `RUN_MIGRATIONS` / `RUN_SMOKE_CHECK` を自動判定。
  - staging は `DEPLOY_AUTHENTIK=false` 固定化。
  - production 手動実行に `deploy_authentik` 入力を追加。
  - staging/production それぞれに設定ファイルのデフォルトパスを設定。
- `scripts/deploy_production_fly.sh`
  - migration / smoke をスキップした場合の明示ログを追加。

### 5. 運用ドキュメント更新
- `docs/Phase2/production-operations.md`
  - Fly設定の環境別使い分け、staging のフラグ自動判定、Authentik デプロイ条件を追記。
  - コスト監視記録テンプレート参照を追記。
- `docs/Phase2/cost-monitoring.md`（新規）
  - 週次コスト監視手順、閾値、エスカレーション、記録テンプレートを追加。
- `docs/security.md`
  - 未完了項目をすべて完了化し、対応内容と確認箇所を更新。

## 検証
- `cd client && pnpm exec vitest run app/tests/integration/request-size.server.integration.test.ts app/tests/integration/quiz.integration.test.ts app/tests/integration/question-management.integration.test.ts`
  - 3ファイル / 5テスト成功
- `cd client && pnpm test`
  - 5ファイル / 9テスト成功
- `cd client && pnpm run build`
  - Remix build 成功

## 実装判断メモ
- CSP は既存実装の inline style/script 影響を考慮し、段階導入として `unsafe-inline` を許可した。
- ボディ上限は route ごとに実運用に十分な値（8KB / 32KB）を設定した。
- Fly 設定は「既定コスト最適化 + production専用上書き」で、コストと可用性の両立方針を明文化した。
