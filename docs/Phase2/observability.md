# Phase2 可観測性 Runbook

## 目的
- Remix（BFF）と Go Backend の境界で、障害検知と原因追跡を短時間化する。
- 最小セットとして以下を常時取得する。
  - 構造化ログ（`requestId` / `userId` / `method` / `status` / `latency`）
  - メトリクス（リクエスト件数、エラー率、p95 レイテンシ）

## 実装範囲
- Backend:
  - `backend/internal/infrastructure/observability/collector.go`
  - `backend/internal/infrastructure/observability/grpc_unary.go`
  - `backend/internal/infrastructure/observability/reporter.go`
  - `backend/internal/transport/grpc/server.go`（interceptor 組み込み）
  - `backend/cmd/server/main.go`（reporter 起動）
- Client（Remix server runtime）:
  - `client/app/services/observability.server.ts`
  - `client/app/entry.server.tsx`（HTTP 観測）
  - `client/app/grpc/client.server.ts`（gRPC client 観測）

## ログ仕様（JSON 1行）
### Backend gRPC アクセスログ
- `type`: `grpc_access`
- `requestId`, `userId`
- `method`: 例 `/historyquiz.quiz.v1.QuizService/GetQuestion`
- `status`: gRPC status name（`OK` / `INVALID_ARGUMENT` など）
- `latencyMs`

### Backend メトリクススナップショット
- `type`: `grpc_metrics_snapshot`
- `metrics[]`:
  - `Method`
  - `RequestCount`
  - `ErrorCount`
  - `ErrorRate`（0.0-1.0）
  - `P95LatencyMs`

### Remix HTTP アクセスログ
- `type`: `http_access`
- `requestId`, `userId`（取得可能な場合）
- `method`: 例 `GET /quiz`
- `status`: HTTP status code
- `statusClass`: `2xx` など
- `latencyMs`

### Remix gRPC client アクセスログ
- `type`: `grpc_client_access`
- `requestId`, `userId`
- `method`: 例 `/historyquiz.question.v1.QuestionService/CreateQuestion`
- `status`: gRPC status name
- `latencyMs`

### Remix メトリクススナップショット
- `type`: `server_metrics_snapshot`
- `metrics[]`:
  - `scope`: `http` or `grpc`
  - `name`
  - `requestCount`
  - `errorCount`
  - `errorRate`（0.0-1.0）
  - `p95LatencyMs`

## メトリクス定義
- リクエスト件数: 期間内に観測された呼び出し総数
- エラー率:
  - Backend gRPC: `status != OK`
  - Remix HTTP: `status >= 500`
  - Remix gRPC client: `status != OK`
- p95 レイテンシ: 直近サンプル窓（最大 512 件）の 95 パーセンタイル

## 設定値（環境変数）
- `BACKEND_OBSERVABILITY_REPORT_INTERVAL_SECONDS`
  - Backend メトリクススナップショット出力間隔（秒）
  - 既定値: `60`
- `CLIENT_OBSERVABILITY_REPORT_INTERVAL_SECONDS`
  - Remix メトリクススナップショット出力間隔（秒）
  - 既定値: `60`

## 最小アラート条件（初期値）
1. 5分間の Backend gRPC エラー率 > 5%
  - 対象: 主要 RPC（`GetQuestion`, `SubmitAnswer`, `CreateQuestion`, `UpdateQuestion`）
2. 5分間の Remix HTTP 5xx 比率 > 2%
  - 対象: `/quiz`, `/questions/new`, `/questions/:id/edit`, `/me`, `/login`
3. 10分間の p95 レイテンシ劣化
  - Backend gRPC p95 > 500ms
  - Remix HTTP p95 > 1,000ms

## 一次対応手順
1. アラート対象時間帯の `requestId` を抽出する。
2. Remix ログ（`http_access` / `grpc_client_access`）で該当 `requestId` を検索する。
3. 同一 `requestId` を Backend `grpc_access` で突合し、失敗 RPC と status を特定する。
4. `status` 別に切り分ける。
  - `UNAVAILABLE`/`DEADLINE_EXCEEDED`: Backend 接続性・Fly 内部ネットワーク・DB到達性を確認
  - `INVALID_ARGUMENT`/`FAILED_PRECONDITION`: 入力不備またはバリデーション回帰を確認
  - `INTERNAL`/`UNKNOWN`: 直近デプロイ差分と panic/例外ログを確認
5. 影響が広い場合は `docs/Phase2/production-operations.md` のロールバック手順で切り戻す。

## ローカル確認コマンド
```bash
# Backend
cd backend
go test ./internal/infrastructure/observability

# Client (integration)
cd ../client
pnpm test
```
