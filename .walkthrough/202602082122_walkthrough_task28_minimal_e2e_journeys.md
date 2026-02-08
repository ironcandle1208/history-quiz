# Walkthrough: Task28 E2E（最小限）主要導線テスト

## 目的
- `docs/tasks.md` の Task28 を実装し、主要導線（ログイン / 作問 / クイズ / マイページ）の退行を検知できるテストを追加する。
- 外部 Authentik や実 gRPC バックエンドへ依存せず、ローカルで安定して再現できる実行形にする。

## 実装内容

### 1. E2E 用 Vitest 設定と実行コマンドを追加
- 追加: `client/vitest.e2e.config.ts`
  - 対象: `tests/e2e/**/*.test.ts`
  - `environment: node`
  - `testTimeout/hookTimeout` を 120 秒に設定
- 更新: `client/package.json`
  - 追加: `test:e2e` (`vitest run --config vitest.e2e.config.ts`)

### 2. 主要導線 E2E シナリオ（route scenario）を追加
- 追加: `client/tests/e2e/main-journeys.e2e.test.ts`
- 方針:
  - Remix の route `loader/action` をユーザー導線順に連結し、Cookie を引き回してシナリオ実行する。
  - OIDC と gRPC はモック化し、境界依存を排除したうえで導線を検証する。
- シナリオ:
  1. `/me` 未認証アクセスで `/login` へリダイレクト
  2. `/login` で OIDC 開始（モック）し、`Set-Cookie` を受け取る
  3. `/auth/callback` でセッション確立（モック OIDC 完了）
  4. `/questions/new` で作問
  5. `/quiz` で出題取得→回答送信
  6. `/me` で履歴/統計/自作問題一覧を確認

### 3. `@conform-to/zod` の v4 エントリへ切り替え
- 更新:
  - `client/app/routes/quiz.tsx`
  - `client/app/routes/questions.new.tsx`
  - `client/app/routes/questions.$id.edit.tsx`
- 内容:
  - import を `@conform-to/zod` から `@conform-to/zod/v4` へ変更。
- 目的:
  - 現在の `zod@4` 環境でビルド互換性を担保する。

### 4. 既存統合テストのモック互換を維持
- 更新: `client/app/tests/integration/setup.ts`
  - `@conform-to/zod` と `@conform-to/zod/v4` の両方を同一モックで提供。

### 5. タスク進捗の更新
- 更新: `docs/tasks.md`
  - Task28 を `[ ]` から `[x]` へ変更。

## 検証
- 実行コマンド: `pnpm -C client test:e2e`
  - 結果: 1ファイル / 1テスト成功
- 実行コマンド: `pnpm -C client test`
  - 結果: 3ファイル / 3テスト成功（既存統合テスト回帰なし）

## 補足
- 今回の E2E は「最小限」のため 1 シナリオに集約している。
- 失敗系（認可エラー・入力エラー・OIDC 異常系）は Task30 のセキュリティ観点チェックに合わせて拡張しやすい構成にしている。
