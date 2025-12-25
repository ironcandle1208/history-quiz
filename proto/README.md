# proto（gRPC 契約）

このディレクトリは、Remix（BFF）↔ Go Backend 間の **単一の真実**（`.proto`）を置く。

## 方針
- 契約（proto）を先に確定し、生成→実装の順で進める（契約駆動）。
- `requestId` は gRPC metadata で伝播することを主としつつ、デバッグ用に message 内にも `context.request_id` を持てる形にしている。
- `userId` は **metadata で伝播**し、バックエンドは message の `user_id` を信頼しない（なりすまし対策）。

## 生成ツール（暫定）
Phase1 ではツールを固定し切らず、以下のどちらでも回せるようにする。

### A. `buf` を使う（推奨候補）
1. `buf.yaml` / `buf.gen.yaml` を追加する
2. `buf generate` で Go/TypeScript の生成物を作る

※ `buf` の導入は後続タスクで確定する（現時点では未導入）。

### B. `protoc` を使う（最小）
前提:
- `protoc` と、Go/TS のプラグインがインストール済みであること

例（コマンドは環境に合わせて調整）:
- Go: `protoc --go_out=... --go-grpc_out=... proto/*.proto`
- TypeScript: `protoc --ts_out=... proto/*.proto`

## ファイル一覧
- `proto/historyquiz/common/v1/common.proto`: 共通型（`RequestContext`, `Pagination`, `ErrorDetail` など）
- `proto/historyquiz/quiz/v1/quiz_service.proto`: クイズ（出題/回答）
- `proto/historyquiz/question/v1/question_service.proto`: 作問（作成/更新/取得/一覧）
- `proto/historyquiz/user/v1/user_service.proto`: マイページ（履歴/統計）
