# Phase2 実装計画

## 目的
Phase2 では、以下 4 テーマを対象に「実装可能な運用基盤」を固める。

1. CSRF トークン導入
2. マイグレーション運用の確定
3. 本番運用詳細（Cloudflare / Fly.io / Neon）の確定
4. 監視・可観測性の導入

## 優先順位と依存関係
1. CSRF トークン導入
2. マイグレーション運用の確定
3. 本番運用詳細の確定
4. 監視・可観測性の導入

依存の考え方:
- `2` は `3` の前提（本番適用フローにマイグレーションを組み込むため）
- `4` は `1-3` と並行可能だが、最終的に `3` の運用Runbookへ統合する

## マイルストーン

### M1: CSRF 保護の全体適用
- 対象: Remix の状態変更系 action（POST）
- 実装:
  - `client/app/services/csrf.server.ts` を追加し、トークン発行/検証を共通化
  - すべての対象フォームへ hidden フィールドでトークンを埋め込み
  - action 側で検証し、失敗時は 403 + requestId で返却
- 完了条件（DoD）:
  - 保護対象 action が 100% CSRF 検証を実施
  - Vitest で「正しいトークン」「欠落」「改ざん」の3系統を検証
  - `docs/Phase2/csrf-rollout.md` に対象一覧と例外方針を記録

### M2: マイグレーション運用の確定
- 対象: ローカル / CI / 本番
- 実装:
  - ツールを 1 つに確定（例: `goose`）し、採用理由を `docs/Phase1/decisions.md` に追記
  - CI で「空DBへ全適用」「順序不整合検知」「必要なら down/up 検証」を自動化
  - 本番適用手順（実行者、タイミング、ロールバック条件）を定義
- 完了条件（DoD）:
  - 開発者が 1 コマンドでローカル適用可能
  - CI で migration 不整合を失敗検知できる
  - `docs/Phase2/migration-operations.md` に運用手順が記載済み

### M3: 本番運用詳細の確定
- 対象: Cloudflare / Fly.io / Neon / Authentik の運用接続点
- 実装:
  - 環境変数とシークレットの管理責務を明確化（命名・保管・ローテーション）
  - デプロイ手順を固定（事前チェック、デプロイ、ヘルスチェック、切り戻し）
  - ネットワーク・接続方針（許可元、TLS、接続失敗時対応）を明文化
- 完了条件（DoD）:
  - `docs/Phase2/production-operations.md` に本番Runbookが揃っている
  - `docs/tech.md` の Known Limitations が該当範囲で解消される
  - 手順通りにステージング相当で再現実行できる

### M4: 監視・可観測性の最小導入
- 対象: Remix + Backend の境界、および主要ユースケース
- 実装:
  - 構造化ログ（requestId, userId, route/RPC, status, latency）を統一
  - 最小メトリクス（リクエスト件数、エラー率、p95 latency）を可視化
  - 重大アラート（5xx急増、依存先不達、遅延悪化）と一次対応手順を定義
- 完了条件（DoD）:
  - 障害時に requestId 起点で追跡可能
  - 主要エラーをアラートで検知できる
  - `docs/Phase2/observability.md` にダッシュボード項目と運用手順が記載済み

## 実行順の提案（2週間スプリント想定）
- Week 1 前半: M1（CSRF）
- Week 1 後半: M2（マイグレーション運用）
- Week 2 前半: M3（本番運用詳細）
- Week 2 後半: M4（可観測性）+ 統合リハーサル

## リスクと先回り対応
- CSRF 対応漏れ:
  - 対応: 対象 route 一覧を作り、PR チェックリスト化
- マイグレーション事故:
  - 対応: 本番前にステージングで適用リハーサルを必須化
- 運用手順の属人化:
  - 対応: コマンドベースで Runbook 化し、手動 UI 操作を最小化
- 監視過不足:
  - 対応: 最小セットで開始し、障害事例ベースでメトリクスを追加

## 成果物一覧
- `docs/Phase2/implementation-plan.md`（本書）
- `docs/Phase2/csrf-rollout.md`
- `docs/Phase2/migration-operations.md`
- `docs/Phase2/production-operations.md`
- `docs/Phase2/observability.md`
