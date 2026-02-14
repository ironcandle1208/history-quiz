# Phase1 決定事項（暫定）

本ファイルは、実装を進めるうえでブレやすい「前提・決定事項」を記録する。
後で変更した場合は、ここに追記し「いつ・なぜ・何が変わったか」を残す。

## 1. ユーザー識別子の扱い（`userId` と OIDC `sub`）

### 決定（暫定）
- Phase1 では `userId = OIDC sub`（Authentik の `sub`）として扱う。

### 理由
- MVP では「ログイン済みユーザーの所有データ分離」が主目的であり、別IDを発行する運用コストを増やさないため。
- DB/セッション/gRPC metadata の値を 1つに揃えられ、実装が単純になるため。

### 影響範囲
- DB の `user_id` / `author_user_id` は **文字列** として保持する（UUID前提にしない）。
- gRPC metadata で `x-user-id` のようなキーに `sub` を載せてバックエンドへ伝播する。
- Remix の Cookie セッションには `userId(sub)` を保持する（トークン本体は保持しない）。

### 将来の変更余地
- 将来的に「アプリ内 userId（UUID）を発行して `auth_subject` と紐付ける」方式へ移行する可能性がある。
- その場合は DB マイグレーションと、認証後のユーザー作成/解決ロジック（Upsert）が必要になる。

## 2. DB マイグレーション運用（ツール/方針）

### 決定（Phase2 で確定: 2026-02-14）
- ツールは `psql` + 運用スクリプト（`scripts/verify_migration_files.sh` / `scripts/apply_db_migrations.sh`）を採用する。
- `backend/db/migrations/` を単一の真実とし、適用順はファイル名のタイムスタンプで管理する。
- 命名規約は `YYYYMMDDHHMMSS_description.sql` に固定し、CI で自動検証する。

### 採用理由
- 現行実装（純SQL + `psql`）と整合し、既存マイグレーションをそのまま運用できるため。
- `goose` などの追加DSL/ヘッダ記法を導入せず、SQL ファイルを直接レビューできるため。
- ローカル・CI・本番で同じ適用経路（同一スクリプト）を使え、手順差分を最小化できるため。

### 運用ルール（確定）
- ローカル:
  - `make db-setup`（内部で `scripts/apply_db_migrations.sh` を実行）
- CI:
  - `.github/workflows/migration-validation.yml` で以下を検証する。
    - 命名/順序検証（`scripts/verify_migration_files.sh`）
    - クリーンDBへの全適用（`scripts/apply_db_migrations.sh`）
- 本番（Neon）:
  - 事前に Neon 側のバックアップ/復元ポイントを確保し、`DATABASE_URL` を本番値にして同一スクリプトを実行する。
  - ロールバックは「原則 forward fix」、緊急時は Neon の復元機能で切り戻す。

### 補足
- 詳細手順は `docs/Phase2/migration-operations.md` を単一の運用Runbookとして参照する。
