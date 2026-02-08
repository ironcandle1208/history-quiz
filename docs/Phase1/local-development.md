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
