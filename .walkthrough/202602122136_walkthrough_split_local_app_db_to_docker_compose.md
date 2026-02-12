# Walkthrough: アプリDB のローカル起動を docker run から docker compose へ分離

## 背景
- `docs/Phase1/local-development.md` ではアプリDB(Postgres)のみ `docker run` を利用していた。
- Authentik 側は `docker compose` 運用であり、ローカル運用の統一と再現性向上のため、アプリDB も Compose 管理へ寄せたい要望があった。

## 実施内容
- 追加: `docker-compose.local-db.yml`
  - `postgres:16` を `app-postgres` サービスとして定義。
  - `POSTGRES_USER/PASSWORD/DB` を `historyquiz` で統一。
  - `5432:5432` を公開。
  - 永続ボリューム `history_quiz_postgres_data` を定義。
  - 起動確認しやすいように `healthcheck(pg_isready)` を追加。
  - Authentik 用 DB と目的が混同しないよう、日本語コメントで役割を明記。
- 更新: `docs/Phase1/local-development.md`
  - アプリDB起動手順を `docker run` から `docker compose -f docker-compose.local-db.yml up -d` へ変更。
  - 停止手順を `docker compose ... down` へ変更（データ保持）。
  - データ破棄手順を `docker compose ... down -v` へ変更。

## 検証
- `docs/Phase1/local-development.md` の DB 起動/停止/削除コマンドが追加した `docker-compose.local-db.yml` と整合していることを確認。
- 実行環境依存のため、コンテナ起動コマンド自体の実行検証は未実施。
