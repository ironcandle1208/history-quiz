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

5. Authentik 管理画面で OIDC Provider / Application を作成する。
1. OIDC Provider を作成する。
- 画面: `Applications` → `Providers` → `Create` → `OAuth2/OpenID Provider`
- ローカル開発での推奨設定例:
  - Name: `history-quiz-local-provider`
  - Authorization flow: `default-provider-authorization-implicit-consent`
  - Client type: `Confidential`
  - Redirect URIs/Origins: `http://localhost:3000/auth/callback`
  - Signing Key: 既定値（変更しない）
- 補足:
  - ローカルでは同意画面を省略するため `implicit-consent` を推奨。
  - 本番では `default-provider-authorization-explicit-consent` の採用を検討する。

2. Provider 作成後に以下を控える。
- Provider slug（例: `history-quiz-local-provider`）
- Client ID
- Client Secret
- Issuer URL（例: `http://localhost:9000/application/o/history-quiz-local-provider`）

3. Application を作成する。
- 画面: `Applications` → `Applications` → `Create`
- 推奨設定例:
  - Name: `history-quiz-local`
  - Slug: `history-quiz-local`
  - Provider: 手順 5-1 で作成した Provider を選択
  - Launch URL: `http://localhost:3000/`

4. Remix 側の環境変数に反映する。
- `OIDC_ISSUER_URL`: `http://localhost:9000/application/o/<provider-slug>`
- `OIDC_CLIENT_ID`: Provider で発行された Client ID
- `OIDC_CLIENT_SECRET`: Provider で発行された Client Secret
- `OIDC_REDIRECT_URI`: `http://localhost:3000/auth/callback`

## 2. アプリDB（Postgres）を用意する
Phase1 では、Neon 本番利用のローカル代替としてローカル Postgres を使う。
リポジトリ直下の `Makefile` に短縮コマンド（`db-setup/db-up/db-down/db-reset`）を用意している。

1. アプリDB のセットアップを一括実行する。
```bash
make db-setup
```

2. `make db-setup` で実行される内容:
- `backend/.env` が無ければ `backend/.env.example` から作成
- `make db-up` でローカル Postgres を起動
- `backend/.env` を読み込んで `DATABASE_URL` を設定
- `backend/db/migrations/*.sql` を順番に適用

### Neon を使う場合
- `backend/.env` の `DATABASE_URL` を Neon 接続文字列に差し替える。
- マイグレーション適用コマンドは同じ。

## 3. Backend（Go / gRPC）を起動する
1. `backend/.env` を shell に読み込む。
```bash
set -a
source backend/.env
set +a
```

2. 起動する。
```bash
cd backend
go run ./cmd/server
```

3. ログに `gRPC server listening on :50051` が出れば起動成功。

## 4. Client（Remix）を起動する
1. 依存関係をインストールする。
```bash
cd client
pnpm install
```

2. 環境変数ファイルを作成する。
```bash
cp .env.example .env
```

3. `.env` を開き、以下を環境に合わせて設定する。
- `OIDC_ISSUER_URL`: `http://localhost:9000/application/o/<your-provider-slug>`
- `OIDC_CLIENT_ID`: Authentik Provider で発行された Client ID
- `OIDC_CLIENT_SECRET`: Authentik Provider で発行された Client Secret
- `OIDC_REDIRECT_URI`: `http://localhost:3000/auth/callback`
- `OIDC_SCOPES`: `openid profile email`
- `BACKEND_GRPC_ADDRESS`: `127.0.0.1:50051`
- `BACKEND_GRPC_TIMEOUT_MS`: `3000`
- `BACKEND_GRPC_TLS`: `false`
- `GRPC_PROTO_ROOT`: `../proto`

4. 起動する。
```bash
pnpm dev
```

5. `http://localhost:3000` へアクセスする。

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
make db-down
```

- ローカル Postgres 削除（データも破棄する場合のみ）:
```bash
make db-reset
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
