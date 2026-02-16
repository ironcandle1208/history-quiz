# Task34: 監視・可観測性の最小導入

## 実施日時
- 2026-02-16 20:14（ローカル）

## 背景
- `docs/tasks.md` の未完了先頭タスクは「34. 監視・可観測性を導入する」だった。
- Phase2 で要求される最小セット（構造化ログ + メトリクス + アラート運用メモ）を実装する必要があった。

## 変更内容
### Backend
- `backend/internal/infrastructure/observability/collector.go`
  - RPC 件数、エラー率、p95 レイテンシを in-memory 集計する Collector を追加。
- `backend/internal/infrastructure/observability/grpc_unary.go`
  - gRPC unary interceptor で構造化アクセスログを出力する `UnaryObserver` を追加。
- `backend/internal/infrastructure/observability/reporter.go`
  - 集計スナップショットを定期 JSON ログ出力する reporter を追加。
- `backend/internal/infrastructure/observability/collector_test.go`
  - 基本集計（件数/エラー率/p95）とサンプル上限のテストを追加。
- `backend/internal/transport/grpc/server.go`
  - interceptor chain に観測 interceptor を挿入できる依存を追加。
- `backend/cmd/server/main.go`
  - Collector/Observer/Reporter の初期化を追加。
  - `BACKEND_OBSERVABILITY_REPORT_INTERVAL_SECONDS` を追加。

### Client (Remix server runtime)
- `client/app/services/observability.server.ts`
  - HTTP/gRPC の構造化ログと in-memory メトリクス集計を共通化。
  - 定期メトリクススナップショット出力を追加。
- `client/app/entry.server.tsx`
  - SSR リクエスト単位で HTTP アクセスログを出力。
  - SSR 例外を構造化 fault ログとして記録。
- `client/app/grpc/client.server.ts`
  - 全 gRPC 呼び出しで `grpc_client_access` ログとメトリクス集計を追加。

### Docs
- `docs/Phase2/observability.md` を新規作成。
  - ログ仕様、メトリクス定義、アラート条件、一次対応を記載。
- `docs/tech.md`
  - Monitoring セクションに実装済み可観測性の概要を追記。
  - Known Limitations から「可観測性未導入」を削除。
- `docs/tasks.md`
  - Task 34 を完了（`[x]`）へ更新。

## 実装判断メモ
- まずは外部依存を増やさず、ログ基盤 + in-memory メトリクスで最小導入とした。
- p95 は固定長サンプル窓（最大512）で算出し、メモリ上限を固定した。
- HTTP パスは動的 ID セグメントを `:id` 化して、メトリクスキーの高カーディナリティ化を抑制した。

## 次の候補
- スナップショットログを永続メトリクス基盤（Prometheus/OpenTelemetry 等）へ送る。
- アラート閾値を実運用データに合わせて再調整する。
