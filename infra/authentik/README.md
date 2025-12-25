# Authentik（OIDC）ローカル起動手順

## 目的
- `Authentik` をローカルで起動し、Remix から OIDC でログインできる状態を作るための手順をまとめる。

## 前提
- Docker / Docker Compose が利用できること

## 起動（例）
1. 環境変数ファイルを用意する
   - `infra/authentik/.env.example` をコピーして `infra/authentik/.env` を作成する
2. 起動する
   - `docker compose --env-file infra/authentik/.env -f infra/authentik/docker-compose.yml up -d`
3. 管理画面へアクセスする
   - `http://localhost:9000/if/admin/`（ポートは compose 設定に依存）

## OIDC アプリ設定のメモ
Authentik 側で「OIDC Provider + Application」を作成し、Remix 側のコールバック URL を登録する。

- **Redirect URI（例）**: `http://localhost:3000/auth/callback`
- **Client ID / Client Secret**: Authentik 管理画面で発行される値を、Remix の環境変数に設定する
- **Scopes（例）**: `openid profile email`

## 補足
- 本 compose はローカル開発向けであり、本番運用ではイメージタグの固定、TLS、バックアップ、監視などの検討が必要。

## 運用メモ（バックアップ/復元）
Authentik の永続データは主に Postgres に保存されるため、バックアップ対象は Postgres を中心に考える。

### ローカル（compose）の例
- バックアップ（例: `pg_dump`）
  - `docker compose --env-file infra/authentik/.env -f infra/authentik/docker-compose.yml exec -T postgresql pg_dump -U $AUTHENTIK_POSTGRES_USER $AUTHENTIK_POSTGRES_DB > authentik_dump.sql`
- 復元（例: `psql`）
  - `cat authentik_dump.sql | docker compose --env-file infra/authentik/.env -f infra/authentik/docker-compose.yml exec -T postgresql psql -U $AUTHENTIK_POSTGRES_USER $AUTHENTIK_POSTGRES_DB`

※本番（Fly.io）では、マネージド Postgres の自動バックアップに加えて、必要に応じて論理バックアップを別ストレージへ保管する。

## 運用メモ（設定のコード化）
- Authentik の設定（OIDC Provider / Application / Flow 等）は、Blueprints 等でコード化し、リポジトリ管理することを推奨する。
- 手作業での設定だけに依存すると、環境差分や復元時の手戻りが発生しやすい。
