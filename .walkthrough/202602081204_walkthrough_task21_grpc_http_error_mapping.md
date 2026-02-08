# Task21: gRPC→HTTP エラー変換（共通）実装

## 実施日時
- 2026-02-08 12:04

## 背景
- `docs/tasks.md` の未完了タスク 21（`gRPC→HTTP エラー変換（共通）`）を実装する必要があった。
- 既存の `client/app/services/grpc-error.server.ts` はステータス変換のみで、レスポンス生成・requestId 伝搬・フィールドエラー抽出が未実装だった。

## 変更内容
1. `client/app/grpc/client.server.ts`
- gRPC 呼び出し失敗時に `requestId` を保持する `GrpcCallError` を追加。
- `invokeUnary` の失敗分岐で raw の `ServiceError` をそのまま投げず、`GrpcCallError` でラップして reject するよう変更。
- `isGrpcCallError` を追加し、上位レイヤーで型安全に判定可能にした。

2. `client/app/services/grpc-error.server.ts`
- `docs/tech.md` の変換表に対応した共通マッピングを、数値 code / 文字列 code の両方で処理できるよう拡張。
- `normalizeGrpcHttpError` を追加し、以下を共通化。
  - gRPC code の正規化
  - HTTP ステータス決定
  - ユーザー表示メッセージ決定（`INTERNAL/UNKNOWN/DATA_LOSS` は詳細を露出しない）
  - requestId 解決（明示指定 → `GrpcCallError` 内包値 → metadata）
  - metadata 由来のフィールドエラー抽出（JSON 形式）
- `createGrpcErrorResponse` / `throwGrpcErrorResponse` を追加し、ルート側が共通レスポンス生成を直接利用できるようにした。
- `x-request-id` を HTTP レスポンスヘッダーへ付与できるようにした。

3. `docs/tasks.md`
- タスク 21 を完了（`[x]`）に更新。

## 設計上の意図
- 今後の `/quiz` `/questions/new` `/questions/:id/edit` `/me` 実装で、ルートごとの独自変換を禁止し、`grpc-error.server.ts` を単一の真実として使える状態にした。
- gRPC エラー時でも requestId を失わないため、問い合わせ時の調査性を確保した。

## 動作確認
- `pnpm --dir client build`

## 変更ファイル
- `client/app/grpc/client.server.ts`
- `client/app/services/grpc-error.server.ts`
- `docs/tasks.md`
- `.walkthrough/202602081204_walkthrough_task21_grpc_http_error_mapping.md`
