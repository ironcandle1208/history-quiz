# Phase1仕様書同期 Walkthrough

## 背景
- 依頼: Phase1 の実装内容を振り返り、`docs` 配下の仕様書を実装実態に合わせて更新する。
- 課題: 仕様書に「実装未着手」「APIGateway 前提」「認証フォーム前提」など、Phase1 実装後とズレる記述が残っていた。

## 確認した実装
- Remix ルート: `client/app/routes/quiz.tsx`, `client/app/routes/questions.new.tsx`, `client/app/routes/questions.$id.edit.tsx`, `client/app/routes/me.tsx`, `client/app/routes/login.tsx`, `client/app/routes/auth.callback.tsx`
- 認証/セッション: `client/app/services/auth.server.ts`, `client/app/services/session.server.ts`, `client/app/services/oidc.server.ts`
- gRPC 境界: `client/app/grpc/client.server.ts`, `client/app/services/grpc-error.server.ts`
- Backend: `backend/internal/transport/grpc/*`, `backend/internal/usecase/*`, `backend/internal/infrastructure/postgres/*`
- DB: `backend/db/migrations/*.sql`

## 変更内容
### 1. `docs/design.md`
- 実装未着手前提の記述を削除し、Phase1 で再利用している共通コンポーネントを明記。
- HTTPインターフェース例を実ルートに合わせて更新（`POST /quiz`, `POST /questions/new`, `POST /questions/:id/edit` など）。
- OIDC ログイン導線（`/login`, `/auth/callback`）を追記。
- データモデルを `userId = OIDC sub` 前提の実態へ補正。
- エラーシナリオのステータス例を実装（gRPC→HTTP変換）に合わせて調整。

### 2. `docs/tech.md`
- 「採用候補/想定」表現を実装済み構成へ更新。
- 依存関係を実態へ補正（`@grpc/grpc-js`, `pgx`, `buf` など）。
- 開発ツール説明を `make` / `buf` ベースの現行フローへ更新。
- `sqlc` を「段階導入」に明確化し、Phase1 は `pgx` 中心であることを追記。
- 既知制約として `page_token` 未実装を追記。

### 3. `docs/requirements.md`
- Requirement 5 を APIGateway 前提から Remix(BFF) 前提へ更新。
- Requirement 9 のログイン要件を OIDC リダイレクトフローに合わせて更新。
- 非機能要件の責務分離表現を Browser/Remix/Backend に統一。

### 4. `docs/product.md`
- ログイン機能の説明を「認証フォーム」から「OIDC認証」へ更新。
- 構成説明を APIGateway 表現から Remix(BFF) 表現へ統一。

### 5. `docs/structure.md`
- 「実装開始前の推奨構造」ではなく、Phase1 実装時点の標準構造であることを明記。
- `backend` 配下の説明を実態（`scripts`, `sqlc.yaml`, `pgx`中心）に合わせて調整。

## 最終状態
- 仕様書（設計・技術・要件・プロダクト・構造）が、Phase1 実装の主要事実と整合する状態になった。
