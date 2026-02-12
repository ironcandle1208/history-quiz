# Walkthrough: Authentik 起動時の Postgres 認証失敗対応

## 発生事象
- Authentik 起動時に以下のエラーが継続発生した。
  - `password authentication failed for user "authentik"`
  - `Connection matched file "/var/lib/postgresql/data/pg_hba.conf" line 128: "host all all all scram-sha-256"`

## 原因
- `docker compose ... config` で `.env` 展開値を確認したところ、compose 上の `POSTGRES_*` と `AUTHENTIK_POSTGRESQL__*` は一致していた。
- 一方で Postgres ログに `PostgreSQL Database directory appears to contain a database; Skipping initialization` が出ており、既存ボリューム内の認証情報が再利用されていた。
- そのため、`.env` の `AUTHENTIK_POSTGRES_PASSWORD` と既存ボリューム内のユーザーパスワード不一致が直接原因と判断した。

## 実施内容
- 更新: `docs/Phase1/local-development.md`
  - 「トラブルシューティング」節を追加。
  - 上記事象の症状、主因、復旧コマンド（`down -v` → `up -d`）を追記。
  - `down -v` のデータ消去影響と、データ保持時の代替案（旧値へ戻す / DB 側パスワード変更）を明記。

## 検証
- `docker compose ... config` により、現行 `.env` の値が compose に正しく反映されることを確認。
- `docker compose ... logs` により、既存 DB 再利用（初期化スキップ）と認証失敗の連続発生を確認。
- ドキュメント改修のみのため、アプリテストは未実施。
