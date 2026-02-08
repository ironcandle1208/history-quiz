# Walkthrough: Task25 問題編集（取得→編集→保存）

## 目的
- `docs/tasks.md` の Task25 を実装し、`/questions/:id/edit` で既存問題の取得・編集・更新を可能にする。
- 非所有者アクセス時のエラー表示（403 相当）と、入力エラーのフィールド表示を統一する。

## 実装内容

### 1. `questions.$id.edit` の loader を本実装化
- 更新: `client/app/routes/questions.$id.edit.tsx`
- 実装した内容:
  - `requireAuthenticatedUser` による認証ガード
  - `createRequestId` で requestId を生成
  - `GetMyQuestion` を呼び出して編集対象を取得
  - 取得データを `conform` の初期値へ変換
    - 選択肢を `ordinal` 順に正規化
    - `correctChoiceId` から `correctOrdinal` を導出
  - 取得失敗時は `throwGrpcErrorResponse` で共通エラー化

### 2. `questions.$id.edit` の action を本実装化
- 更新: `client/app/routes/questions.$id.edit.tsx`
- 実装した内容:
  - `parseWithZod(createQuestionFormSchema)` によるサーバー側一次検証
  - `UpdateQuestion` を呼び出して更新保存
  - 成功時に更新結果と `requestId` を返却
  - gRPC エラー時:
    - `normalizeGrpcHttpError` で HTTP 形式へ正規化
    - バックエンドの `field` 名を conform フィールドへ変換
    - `submission.reply({ fieldErrors, formErrors })` で UI に反映

### 3. フォーム UI と ErrorBoundary を実装
- 更新: `client/app/routes/questions.$id.edit.tsx`
- 実装した内容:
  - `useForm` + `getFormProps/getInputProps/getTextareaProps/getCollectionProps` を適用
  - 問題文・選択肢4件・正解ラジオ・解説を編集可能化
  - 送信中/成功/失敗メッセージを表示
  - `ErrorBoundary` を追加し、`requestId` と再導線（`/me`）を表示
  - 追加した各関数に日本語コメントを記述し、保守時の意図を明確化

### 4. タスク管理更新
- 更新: `docs/tasks.md`
- `Task25` を `[ ]` から `[x]` に更新

## 検証
- 実行: `pnpm -C client exec tsc --noEmit`
- 結果: 型エラーなし
