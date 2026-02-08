# Walkthrough: Task29 ローカル開発手順の整備

## 目的
- `docs/tasks.md` の Task29（ローカル開発手順）を実装し、Authentik / DB / client / backend の起動導線を Phase1 ドキュメントとして固定する。

## 実装内容

### 1. Phase1 ローカル開発ガイドを新規作成
- 追加: `docs/Phase1/local-development.md`
- 記載内容:
  - 前提ツール（Docker / Node / pnpm / Go / psql）
  - Authentik 起動手順（`.env` 作成、compose 起動、管理画面確認、OIDC 設定で控える値）
  - ローカル Postgres を Neon 代替として起動する手順
  - `backend/db/migrations/*.sql` の順次適用手順
  - backend（gRPC）起動手順
  - client（Remix）起動手順と必要環境変数
  - 最小動作確認フロー（ログイン→作問→クイズ→マイページ）
  - 停止/クリーンアップ手順

### 2. タスク進捗を更新
- 更新: `docs/tasks.md`
  - Task29 を `[ ]` から `[x]` に更新

## 検証
- ドキュメント変更のみのため、テスト実行は未実施。
- 記載コマンドと環境変数名は現行実装（`client/app/services/oidc.server.ts`, `client/app/grpc/client.server.ts`, `backend/cmd/server/main.go`）に合わせて照合した。
