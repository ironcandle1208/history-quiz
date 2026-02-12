# Walkthrough: Phase1 アプリDBセットアップのスクリプト化

## 背景
- `docs/Phase1/local-development.md` の「2. アプリDB（Postgres）を用意する」は複数コマンドを順番に実行する必要があり、手順漏れが起きやすかった。
- ローカル開発の初期セットアップを 1 コマンドで再現できるようにしたい要望があった。

## 実施内容
- 追加: `scripts/setup_local_app_db.sh`
  - `backend/.env` が無い場合に `backend/.env.example` から自動作成。
  - `make db-up` でアプリDB を起動。
  - `set -a; source backend/.env; set +a` で `DATABASE_URL` を読み込み。
  - Postgres の起動完了を `psql ... -c "select 1"` で待機確認。
  - `backend/db/migrations/*.sql` を順番に適用。
  - 必須コマンド不足や `DATABASE_URL` 未設定時は明示的に失敗するようにした。
- 更新: `Makefile`
  - `db-setup` ターゲットを追加し、`scripts/setup_local_app_db.sh` を実行するように変更。
  - `help` に `db-setup` の説明を追加。
- 更新: `docs/Phase1/local-development.md`
  - アプリDB セットアップ手順を `make db-setup` 中心へ変更。
  - `db-setup` で実行される内容を明記。

## 検証
- `bash -n scripts/setup_local_app_db.sh` で構文エラーがないことを確認。
- `make help` で `db-setup` が表示されることを確認。
- `make -n db-setup` でスクリプト呼び出しが行われることを確認。
