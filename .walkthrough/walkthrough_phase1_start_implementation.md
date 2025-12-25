# Walkthrough: Phase1 実装開始（骨格・契約先行）

## 目的
- `docs/tasks.md` に従い、実装を開始するための土台（ディレクトリ/決定事項/契約）を整備する。

## 実施内容
- `docs/Phase1/decisions.md` を追加し、以下を暫定決定として記録した。
  - `userId = OIDC sub` として扱う（DB は文字列で保持）
  - マイグレーションは `backend/db/migrations/` にSQLで管理し、ツールは後で確定
- `client/` `backend/` `proto/` の骨格を追加した。
  - `client/README.md`
  - `backend/README.md`
  - `proto/README.md`
- gRPC 契約（proto）を追加した。
  - `proto/historyquiz/common/v1/common.proto`
  - `proto/historyquiz/quiz/v1/quiz_service.proto`
  - `proto/historyquiz/question/v1/question_service.proto`
  - `proto/historyquiz/user/v1/user_service.proto`
- DB 初期スキーマと既定問題セット（フォールバック）を追加した。
  - `backend/db/migrations/20251225233000_init.sql`
  - `backend/sqlc.yaml`
  - `backend/db/queries/*.sql`（置き場の確定）
- Go バックエンド（gRPC）起動の骨格を追加した。
  - `backend/go.mod`
  - `backend/cmd/server/main.go`
  - `backend/internal/transport/grpc/server.go`
  - `backend/internal/transport/grpc/interceptors/metadata.go`
  - `backend/internal/app/contextkeys/contextkeys.go`
- Remix（client）側の骨格を追加した（Remix 初期化は後続で確定/導入）。
  - `client/package.json`, `client/tsconfig.json`
  - `client/app/routes/*`（画面の雛形）
  - `client/app/services/*`（セッション/認証/エラー変換の雛形）
  - `client/app/grpc/client.server.ts`（サーバ専用 gRPC クライアントの雛形）
- proto 生成（Go）を可能にするため、ツール設定と生成物を追加した。
  - `proto/buf.yaml`, `proto/buf.gen.yaml`（buf）
  - `backend/proto/**`（Go 向け生成物）
  - `backend/internal/transport/grpc/services/*`（サービスの暫定実装）

## 背景・意図
- 早期にブレやすい前提（ユーザー識別子とマイグレーション運用）を固定しないと、DB/認可/セッションの実装が分岐しやすい。
- Phase1 は MVP を優先し、実装の単純さを重視する。
 - まずは「契約（proto）→DB制約」の順で境界と不変条件を固定し、Remix/Backend 実装の手戻りを減らす。
 - gRPC metadata から `userId/requestId` を context に注入する共通処理を先に作り、後続のユースケース実装で再利用できるようにする。

## 注意点（環境）
- `go` / `protoc` / `buf` を導入し、`go test ./...` で Go 側のコンパイル確認を行える状態にした。
  - buf はデフォルトで `~/.cache/buf` を使うため、実行時は `BUF_CACHE_DIR` をワークスペース配下に向ける必要があった。
 - Remix についても依存関係の導入（`pnpm add` 等）は未実施のため、起動検証は未実施。

## 次にやること
- Go バックエンドの transport/usecase/repository の骨格を作る
- Remix のセッションと gRPC クライアント（サーバ専用）の骨格を作る
 - DB接続と sqlc 生成（Repository）を実装し、暫定実装を置き換える
