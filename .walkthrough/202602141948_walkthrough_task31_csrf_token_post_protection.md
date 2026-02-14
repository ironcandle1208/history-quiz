# Task31: CSRF トークン導入（状態変更 POST 保護）

## 実施日時
- 2026-02-14 19:48

## 背景
- `docs/tasks.md` の未完了タスク 31（CSRF トークン導入）を完了する必要があった。
- Phase1 までは `SameSite=Lax` と OIDC `state` を中心に防御していたが、状態変更 `POST` に明示的な CSRF 検証は未導入だった。

## 変更内容
1. 共通 CSRF サービスを追加
- `client/app/services/csrf.server.ts` を新規作成した。
- `issueCsrfToken` でセッション単位のトークンを発行（初回のみ `Set-Cookie` 返却）する実装を追加した。
- `verifyCsrfToken` で hidden input のトークンを検証し、不一致時は `403` と `requestId` を返す実装を追加した。

2. セッション層に CSRF 保持を追加
- `client/app/services/session.server.ts` に `csrfToken` セッションキーを追加した。
- `getSessionCsrfToken` / `ensureSessionCsrfToken` を追加し、CSRF トークンの取得・初回生成を共通化した。

3. 全 POST action へ適用
- `client/app/routes/login.tsx`（ログアウト）
- `client/app/routes/quiz.tsx`（回答送信）
- `client/app/routes/questions.new.tsx`（問題作成）
- `client/app/routes/questions.$id.edit.tsx`（問題更新）

各 route で以下を実施:
- loader で `csrfToken` を返却
- フォームに `hidden input(name=csrfToken)` を追加
- action 冒頭で `verifyCsrfToken` を実行

4. テストとドキュメント更新
- 追加: `client/app/tests/integration/csrf.server.integration.test.ts`
  - トークン再利用
  - 正常検証
  - 不一致時 403
- 既存 integration/e2e のルートシナリオは `csrf.server` をモックし、既存導線検証を維持した。
- `docs/Phase2/csrf-rollout.md` を新規作成し、ロールアウト内容を記録した。
- `docs/tasks.md` の Task31 を完了（`[x]`）に更新した。

## 設計上の意図
- 実装ルールを「loader発行 / hidden input / action検証」の 3 点に固定し、今後の POST 追加時に迷わない形にした。
- CSRF 失敗時も `requestId` を返すことで、既存の障害調査導線（requestId 起点）を維持した。

## 動作確認
- `pnpm --dir client exec vitest run app/tests/integration/csrf.server.integration.test.ts app/tests/integration/question-management.integration.test.ts app/tests/integration/quiz.integration.test.ts tests/e2e/main-journeys.e2e.test.ts`

## 変更ファイル
- `client/app/services/session.server.ts`
- `client/app/services/csrf.server.ts`
- `client/app/routes/login.tsx`
- `client/app/routes/quiz.tsx`
- `client/app/routes/questions.new.tsx`
- `client/app/routes/questions.$id.edit.tsx`
- `client/app/tests/integration/csrf.server.integration.test.ts`
- `client/app/tests/integration/question-management.integration.test.ts`
- `client/app/tests/integration/quiz.integration.test.ts`
- `client/tests/e2e/main-journeys.e2e.test.ts`
- `docs/Phase2/csrf-rollout.md`
- `docs/tasks.md`
- `.walkthrough/202602141948_walkthrough_task31_csrf_token_post_protection.md`
