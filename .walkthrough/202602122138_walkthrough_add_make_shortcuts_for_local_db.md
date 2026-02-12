# Walkthrough: ローカルアプリDB操作の短縮コマンド追加

## 背景
- アプリDB を `docker-compose.local-db.yml` で分離した後、起動・停止・初期化コマンドを毎回フルで入力する必要があった。
- ローカル開発時の操作を簡潔にするため、短縮コマンドを追加したい要望があった。

## 実施内容
- 追加: `Makefile`
  - `db-up`: アプリDB(Postgres)を `docker compose -f docker-compose.local-db.yml up -d` で起動。
  - `db-down`: アプリDB(Postgres)を `docker compose -f docker-compose.local-db.yml down` で停止（データ保持）。
  - `db-reset`: アプリDB(Postgres)を `docker compose -f docker-compose.local-db.yml down -v` で停止+ボリューム削除。
  - `help`: 利用可能な短縮コマンドを表示。
  - 各ターゲットの役割が分かるよう、日本語コメントを記載。
- 更新: `docs/Phase1/local-development.md`
  - アプリDB起動手順を `make db-up` に変更。
  - 停止手順を `make db-down` に変更。
  - データ破棄手順を `make db-reset` に変更。
  - `Makefile` に短縮コマンドがある旨を補足。

## 検証
- `make help` でターゲット説明が表示されることを確認。
- `make -n db-up db-down db-reset` で実行予定コマンドが期待どおり展開されることを確認。
