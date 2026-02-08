# Walkthrough: Task20 Remix の gRPC クライアント（サーバ側専用）実装

## 目的
- `docs/tasks.md` の Task20 を実装し、Remix から Go Backend へ呼び出す gRPC クライアント基盤をサーバ専用で整備する。
- `x-user-id` / `x-request-id` の metadata 伝播と deadline 制御を共通化する。

## 実装内容

### 1. 依存追加
- 更新: `client/package.json`, `client/pnpm-lock.yaml`
- 追加依存:
  - `@grpc/grpc-js`
  - `@grpc/proto-loader`

### 2. gRPC 共通基盤の実装
- 更新: `client/app/grpc/client.server.ts`
- 実装した内容:
  - サーバ専用ガード（ブラウザ実行時は例外）
  - gRPC 接続先解決（`BACKEND_GRPC_ADDRESS`, 既定 `127.0.0.1:50051`）
  - timeout 解決（`BACKEND_GRPC_TIMEOUT_MS`, 既定 `3000ms`）
  - TLS 切替（`BACKEND_GRPC_TLS=true` の場合のみ `createSsl`）
  - proto ルート解決（`GRPC_PROTO_ROOT` または `../proto` / `./proto`）
  - `@grpc/proto-loader` による `.proto` 動的ロード
  - Quiz/Question/User 各サービスのクライアント初期化（シングルトン）
  - requestId 生成（`crypto.randomUUID` + fallback）
  - metadata 付与（`x-user-id`, `x-request-id`）
  - request message 側 `context.requestId` の自動補完
  - unary RPC 実行の共通化（deadline 付き）

### 3. サービス別ラッパー追加
- 追加:
  - `client/app/grpc/quiz.server.ts`
  - `client/app/grpc/question.server.ts`
  - `client/app/grpc/user.server.ts`
- 実装した内容:
  - 各 proto に対応するリクエスト/レスポンス型（TS）
  - 各 RPC の呼び出し関数（typed wrapper）
    - Quiz: `getQuestion`, `submitAnswer`
    - Question: `createQuestion`, `updateQuestion`, `getMyQuestion`, `listMyQuestions`
    - User: `listMyAttempts`, `getMyStats`

### 4. タスク更新
- 更新: `docs/tasks.md`
- `Task20` を `[x]` に更新。

## 検証
- 実行: `pnpm -C client exec tsc --noEmit`
- 結果: 型エラーなし

- 実行: `pnpm -C client build`
- 結果: ビルド成功（Remix v7 移行に関する warning のみ）
