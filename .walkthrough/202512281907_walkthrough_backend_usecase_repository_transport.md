# Walkthrough: Backend（Repository/Usecase/Transport）実装

## 目的
- `docs/tasks.md` の未完了タスク（11〜15）に従い、Go バックエンドで「DB永続化 + ユースケース + gRPC transport」を接続して、暫定実装（固定問題/Unimplemented）を置き換える。

## 実施内容
### 1) Domain / Error 表現
- `backend/internal/domain/models.go` を追加し、Question/Choice/Attempt/Stats などのドメインモデルを定義。
- `backend/internal/domain/apperror/apperror.go` を追加し、usecase→transport 間で共有するエラーコード（INVALID_ARGUMENT/NOT_FOUND 等）を定義。

### 2) DB 接続（Postgres）
- `backend/internal/infrastructure/postgres/pool.go` を追加し、`DATABASE_URL` から `pgxpool` を作成する処理を実装。
- `backend/internal/infrastructure/postgres/tx.go` を追加し、トランザクション管理（begin/commit/rollback）を共通化。

### 3) Repository（Postgres 実装）
- `backend/internal/repository/*` に Repository インターフェースを定義。
- `backend/internal/infrastructure/postgres/*_repository.go` を追加し、users/questions/choices/answer_keys/attempts を扱う実装を追加。
  - `deleted_at IS NULL` を基本条件として、論理削除済みを出題/一覧から除外する。
  - 作問（Create/Update）はトランザクション内で questions → choices(4件) → answer_keys を確定する。

### 4) Usecase（Quiz/Question/User）
- `backend/internal/usecase/quiz`:
  - `GetQuestion`: DB の保存済み問題から出題し、空の場合は既定問題セットへフォールバック。
  - `SubmitAnswer`: 正誤判定し、ログイン済みなら attempts を保存（未ログインなら保存しない）。
- `backend/internal/usecase/question`:
  - Create/Update/Get/List（所有者チェック、4択/正解 ordinal のバリデーション）。
- `backend/internal/usecase/user`:
  - ListMyAttempts / GetMyStats（正答率=correct/total）。

### 5) gRPC transport（proto 契約 → usecase）
- `backend/internal/transport/grpc/services/*.go` を更新し、暫定実装を usecase 委譲に置き換え。
- `backend/internal/transport/grpc/server.go` を更新し、`Dependencies` 経由で usecase を注入してサービス登録。
- `backend/cmd/server/main.go` を更新し、DB 接続→Repository→Usecase→gRPC Server を DI する。

## 動作確認（ローカル）
- `go mod tidy` を実行し、依存（`pgx` / `uuid`）を反映。
- `go test ./...` によりコンパイル確認。
  - こちらの環境では `GOCACHE` がデフォルトだと権限エラーになり得るため、`backend/.cache` 配下に向けて実行した。

## 次にやること
- `docs/tasks.md` の 16（主要ユースケースのユニットテスト）を追加する。
- Remix 側（17〜）を進める際に、`DATABASE_URL` のローカル開発手順（29）も併せて整理する。

