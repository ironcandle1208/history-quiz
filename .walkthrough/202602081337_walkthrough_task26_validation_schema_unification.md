# Walkthrough: Task26 入力検証スキーマ整理とエラー表現統一

## 実施日時
- 2026-02-08 13:37

## 背景
- `docs/tasks.md` の Task 26（Remix の入力検証スキーマ整備とフォームエラー表現統一）が未完了だった。
- `questions.new` と `questions.$id.edit` で gRPC field error の conform 変換ロジックが重複していた。
- `quiz` ルートは手書きの必須チェックで、スキーマ駆動の検証に未統一だった。

## 変更内容
1. 共通スキーマ部品の追加
- `client/app/schemas/common.ts` を追加。
- `createRequiredTrimmedTextSchema` を追加し、未入力時の必須エラーメッセージを統一できるようにした。

2. 問題フォームスキーマの整理
- `client/app/schemas/question.ts` に以下を集約。
  - 既存 `createQuestionFormSchema`
  - `mapQuestionGrpcFieldToConformField`
  - `toQuestionConformFieldErrors`
- `questions.new` / `questions.$id.edit` から重複していたフィールド名変換処理を削除し、共通関数呼び出しに置換。

3. クイズ回答スキーマの追加
- `client/app/schemas/quiz.ts` を追加。
- `quizAnswerFormSchema`（`questionId`, `choiceId`）を追加。
- gRPC の field 名ゆれを吸収する `resolveQuizChoiceFieldError` を追加。

4. クイズ action の検証統一
- `client/app/routes/quiz.tsx` の action で `parseWithZod` + `quizAnswerFormSchema` を使うように変更。
- 手書きの必須チェックを廃止し、スキーマベースのエラー返却に統一。
- gRPC エラー時も `resolveQuizChoiceFieldError` を介して `choiceId` エラーを統一。

5. タスク管理更新
- `docs/tasks.md` の Task 26 を完了（`[x]`）に更新。

## 変更ファイル
- `client/app/schemas/common.ts`（新規）
- `client/app/schemas/question.ts`
- `client/app/schemas/quiz.ts`（新規）
- `client/app/routes/questions.new.tsx`
- `client/app/routes/questions.$id.edit.tsx`
- `client/app/routes/quiz.tsx`
- `docs/tasks.md`

## 動作確認
- 実行コマンド: `cd client && pnpm -s exec tsc --noEmit`
- 結果: 型エラーなし

## 補足
- Backend 側の最終バリデーション（不変条件チェック）を前提に、Remix 側は UX 改善のための一次検証に留めている。
