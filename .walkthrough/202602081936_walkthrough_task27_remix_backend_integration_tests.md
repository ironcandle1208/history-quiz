# Walkthrough: Task27 Remix↔Backend 統合テスト（主要フロー）

## 目的
- `docs/tasks.md` の Task27 を実装し、Remix ルート（loader/action）と gRPC 呼び出し境界の主要フロー回帰を検知できる状態にする。
- 外部ネットワークや実バックエンドに依存せず、モック transport で deterministic に実行できることを担保する。

## 実装内容

### 1. テストランナーの追加
- 更新: `client/package.json`
  - 追加: `test`, `test:watch` スクリプト（Vitest）
- 追加: `client/vitest.config.ts`
  - 統合テスト対象を `app/tests/integration/**/*.test.ts` に限定
  - `setupFiles` に `app/tests/integration/setup.ts` を指定

### 2. `@conform-to/zod` 互換モックの追加
- 追加: `client/app/tests/integration/setup.ts`
- 背景:
  - 実行時に `@conform-to/zod` と `zod` の export 互換エラーが出るため、テスト側で最小実装をモック化。
- 実装:
  - `parseWithZod` の必要最小インターフェース（`status`, `value/error`, `reply`）を再現
  - `getZodConstraint` は統合テストで未使用のため空制約を返却

### 3. 主要フロー統合テストの追加
- 追加: `client/app/tests/integration/quiz.integration.test.ts`
  - シナリオ: 出題 → 回答 → 次問題取得
  - 検証: `getQuestion` / `submitAnswer` の入力、レスポンス、`x-request-id`
- 追加: `client/app/tests/integration/question-management.integration.test.ts`
  - シナリオ: 作問 → 一覧表示（`/me`）→ 編集
  - 検証: `createQuestion` / `listMyQuestions` / `getMyQuestion` / `updateQuestion` の連携
- 追加: `client/app/tests/integration/me.integration.test.ts`
  - シナリオ: マイページの履歴・統計・自作問題一覧
  - 検証: `listMyAttempts` / `getMyStats` / `listMyQuestions` が同一 `requestId` で呼ばれること

### 4. タスク管理の更新
- 更新: `docs/tasks.md`
  - Task27 を `[ ]` から `[x]` へ更新

## 検証
- 実行コマンド: `pnpm -C client test`
- 結果: 3ファイル / 3テストが全件成功

## 補足
- `vi.mock` の巻き上げ順序問題を回避するため、テスト内モック関数は `vi.hoisted` で定義した。
