# Task32: DB マイグレーション運用確定（ローカル/CI/本番）

## 実施日時
- 2026-02-14 20:31

## 背景
- `docs/tasks.md` の未完了タスク 32 を完了する必要があった。
- `docs/Phase1/decisions.md` ではマイグレーション運用が暫定のままで、CI/本番フローが未確定だった。

## 変更内容
1. 運用スクリプトを追加
- `scripts/verify_migration_files.sh` を新規作成した。
  - 命名規約 `YYYYMMDDHHMMSS_description.sql` の検証
  - タイムスタンプ昇順の検証
- `scripts/apply_db_migrations.sh` を新規作成した。
  - `DATABASE_URL` を使って SQL を順次適用
  - 適用前に `verify_migration_files.sh` を実行
  - 各ファイルを単一トランザクション（`psql -1`）で適用

2. 既存ローカルセットアップを共通スクリプトに寄せた
- `scripts/setup_local_app_db.sh` の手動ループ適用を削除し、`scripts/apply_db_migrations.sh` を呼ぶ形へ統一した。

3. CI 検証フローを追加
- `.github/workflows/migration-validation.yml` を新規作成した。
- PR / main push 時に以下を実行する。
  - 命名/順序検証
  - クリーン Postgres への全適用検証

4. ドキュメント更新
- `docs/Phase1/decisions.md`
  - DB マイグレーション運用を「暫定」から「確定」に更新
  - 採用ツール、CI、本番ロールバック方針を明記
- `docs/Phase2/migration-operations.md`
  - ローカル/CI/本番の実行手順とチェックリストを新規記載
- `docs/Phase1/local-development.md`
  - `make db-setup` の実行内容を新スクリプトに合わせて更新
- `docs/tasks.md`
  - Task32 を完了（`[x]`）に更新

## 設計上の意図
- `goose` などの追加記法を導入せず、既存の純SQL資産を維持しながら運用の再現性を上げる方針を採用した。
- ローカル/CI/本番で同一スクリプトを使うことで、環境差異による事故リスクを下げた。

## 動作確認
- `bash -n scripts/setup_local_app_db.sh scripts/verify_migration_files.sh scripts/apply_db_migrations.sh`
- `./scripts/verify_migration_files.sh`

## 変更ファイル
- `scripts/verify_migration_files.sh`
- `scripts/apply_db_migrations.sh`
- `scripts/setup_local_app_db.sh`
- `.github/workflows/migration-validation.yml`
- `docs/Phase1/decisions.md`
- `docs/Phase2/migration-operations.md`
- `docs/Phase1/local-development.md`
- `docs/tasks.md`
- `.walkthrough/202602142031_walkthrough_task32_migration_operations_finalize.md`
