# Phase1 ローカル開発手順

## 目的
- `history_quiz` をローカルで再現可能に起動し、ログイン・作問・クイズ・マイページまでを一通り確認できる状態を作る。
- Authentik（OIDC）、アプリDB、Remix/Go バックエンドの起動手順を 1 つにまとめる。

## 前提
- Docker / Docker Compose が利用できること
- `node >= 18` と `pnpm` が利用できること
- `go >= 1.24` が利用できること
- SQL マイグレーション適用用に `psql` が利用できること

## 1. Authentik（OIDC）を起動する
1. `.env` を作成する。
```bash
cp infra/authentik/.env.example infra/authentik/.env
```

2. `infra/authentik/.env` の `change-me-please` をローカル用の値へ置き換える。

3. Authentik を起動する。
```bash
docker compose --env-file infra/authentik/.env -f infra/authentik/docker-compose.yml up -d
```

4. 管理画面へアクセスする。
- URL: `http://localhost:9000/if/admin/`
- 初期管理者: `infra/authentik/.env` の `AUTHENTIK_BOOTSTRAP_EMAIL` / `AUTHENTIK_BOOTSTRAP_PASSWORD`

5. Authentik 管理画面で OIDC Provider / Application を作成し、以下を控える。
- Issuer URL（Provider 画面に表示される値）
- Client ID
- Client Secret
- Redirect URI: `http://localhost:3000/auth/callback`

## 2. アプリDB（Postgres）を用意する
Phase1 では、Neon 本番利用のローカル代替としてローカル Postgres を使う。

1. ローカル Postgres を起動する。
```bash
docker run --name history-quiz-postgres \
  -e POSTGRES_USER=historyquiz \
  -e POSTGRES_PASSWORD=historyquiz \
  -e POSTGRES_DB=historyquiz \
  -p 5432:5432 \
  -d postgres:16
```

2. `DATABASE_URL` を設定する。
```bash
export DATABASE_URL='postgresql://historyquiz:historyquiz@127.0.0.1:5432/historyquiz?sslmode=disable'
```

3. マイグレーションを順番に適用する。
```bash
for f in backend/db/migrations/*.sql; do
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"
done
```

### Neon を使う場合
- `DATABASE_URL` を Neon 接続文字列に差し替える。
- マイグレーション適用コマンドは同じ。

## 3. Backend（Go / gRPC）を起動する
1. `DATABASE_URL` が設定済みであることを確認する。

2. 起動する。
```bash
cd backend
PORT=50051 go run ./cmd/server
```

3. ログに `gRPC server listening on :50051` が出れば起動成功。

## 4. Client（Remix）を起動する
1. 依存関係をインストールする。
```bash
cd client
pnpm install
```

2. 環境変数を設定して起動する。
```bash
SESSION_SECRET='dev-only-session-secret-change-me' \
OIDC_ISSUER_URL='http://localhost:9000/application/o/<your-provider-slug>' \
OIDC_CLIENT_ID='<your-client-id>' \
OIDC_CLIENT_SECRET='<your-client-secret>' \
OIDC_REDIRECT_URI='http://localhost:3000/auth/callback' \
OIDC_SCOPES='openid profile email' \
BACKEND_GRPC_ADDRESS='127.0.0.1:50051' \
BACKEND_GRPC_TIMEOUT_MS='3000' \
BACKEND_GRPC_TLS='false' \
GRPC_PROTO_ROOT='../proto' \
pnpm dev
```

3. `http://localhost:3000` へアクセスする。

## 5. 動作確認（最小）
1. `http://localhost:3000/login` へアクセスして Authentik ログインを完了する。
2. `/questions/new` で問題を作成する。
3. `/quiz` で出題取得→回答を確認する。
4. `/me` で履歴・正答率・自作問題一覧を確認する。

## 停止・クリーンアップ
- Authentik 停止:
```bash
docker compose --env-file infra/authentik/.env -f infra/authentik/docker-compose.yml down
```

- ローカル Postgres 停止:
```bash
docker stop history-quiz-postgres
```

- ローカル Postgres 削除（データも破棄する場合のみ）:
```bash
docker rm -f history-quiz-postgres
```

## トラブルシューティング

### Authentik 起動時に `password authentication failed for user "authentik"` が出る
- 症状例:
  - `password authentication failed for user "authentik"`
  - `Connection matched file "/var/lib/postgresql/data/pg_hba.conf" ... "host all all all scram-sha-256"`
- 主な原因:
  - `infra/authentik/.env` の `AUTHENTIK_POSTGRES_PASSWORD` を変更したが、既存の Postgres ボリュームには変更前パスワードが残っている。
- 対処（Authentik のローカルデータを破棄して再初期化する場合）:
```bash
docker compose --env-file infra/authentik/.env -f infra/authentik/docker-compose.yml down -v
docker compose --env-file infra/authentik/.env -f infra/authentik/docker-compose.yml up -d
```
- 補足:
  - `down -v` は Authentik 用の Postgres/Redis/Media ボリュームを削除するため、ローカルの Authentik データは消える。
  - データを残したい場合は、`infra/authentik/.env` を過去の値に戻すか、既存 DB 側のユーザーパスワードを現在値へ変更する。

### `AUTHENTIK_BOOTSTRAP_EMAIL` / `AUTHENTIK_BOOTSTRAP_PASSWORD` でログインできない
- 症状例:
  - `AUTHENTIK_BOOTSTRAP_PASSWORD` を入力しても `invalid password` になる。
- 主な原因:
  - `AUTHENTIK_BOOTSTRAP_EMAIL` / `AUTHENTIK_BOOTSTRAP_PASSWORD` は DB 初回初期化時の管理者作成にだけ使われる。
  - 既存 DB がある状態では、`.env` の bootstrap 値を変更しても既存管理者のログイン情報は更新されない。
- 切り分け:
  - サービス状態を確認する。
```bash
docker compose --env-file infra/authentik/.env -f infra/authentik/docker-compose.yml ps
```
  - `server` ログで `Invalid credentials` が出ているか確認する。
```bash
docker compose --env-file infra/authentik/.env -f infra/authentik/docker-compose.yml logs --tail=200 server
```
  - 既存ユーザー（username/email）を確認する。
```bash
docker compose --env-file infra/authentik/.env -f infra/authentik/docker-compose.yml exec -T server ak shell -c "from authentik.core.models import User; print(list(User.objects.values_list('username','email')[:20]))"
```
- 対処（既存データを保持する場合）:
  - 既存の管理者ユーザー（例: `akadmin`）のパスワードを再設定する。
```bash
docker compose --env-file infra/authentik/.env -f infra/authentik/docker-compose.yml exec server ak changepassword akadmin
```
- 対処（bootstrap 値を再適用したい場合）:
  - ボリュームを削除して再初期化する。
```bash
docker compose --env-file infra/authentik/.env -f infra/authentik/docker-compose.yml down -v
docker compose --env-file infra/authentik/.env -f infra/authentik/docker-compose.yml up -d
```
