# Task 23 Walkthrough: 問題作成フォームの本実装

## 実施日時
- 2026-02-08 12:49 (local)

## 背景
- `docs/tasks.md` の次タスクとして `23. 問題作成（フォーム/バリデーション/保存結果）` を実装。
- 既存の `client/app/routes/questions.new.tsx` は仮実装で、`prompt` 単一入力のみ、gRPC 未接続だった。

## 変更内容

### 1. 依存導入（zod + conform）
- `client/package.json`
  - `zod`
  - `@conform-to/react`
  - `@conform-to/zod`
- ネットワーク制限のため通常権限では取得失敗し、昇格実行で依存を導入した。

### 2. 問題作成スキーマを新規追加
- `client/app/schemas/question.ts` を新規作成。
- `createQuestionFormSchema` を定義し、以下を一次検証:
  - `prompt`: 必須
  - `choices`: 4件固定、各必須
  - `correctOrdinal`: 0..3 の整数
  - `explanation`: 任意、最大500文字
- `QUESTION_CHOICES_COUNT` 定数と `CreateQuestionFormValue` 型を公開。

### 3. `questions.new` を本実装へ置換
- `client/app/routes/questions.new.tsx`
  - `loader`: `requireAuthenticatedUser` による認証ガード
  - `action`:
    - `parseWithZod` でサーバー側一次検証
    - 成功時は `createQuestion` (gRPC) を呼び出し
    - 成功レスポンスに `x-request-id` を付与
    - gRPC 失敗時は `normalizeGrpcHttpError` で正規化
    - バックエンドの `draft.xxx` フィールド名を conform のフィールド名へ変換して表示
  - UI:
    - 問題文、選択肢4件、正解ラジオ、任意の解説を表示
    - `useForm` + `getFormProps/getInputProps/getTextareaProps/getCollectionProps` を適用
    - フィールド単位のエラー表示と成功表示を実装

### 4. タスク管理更新
- `docs/tasks.md`
  - Task 23 を `[x]` に更新。

## 検証
- 実行コマンド:
  - `pnpm exec tsc --noEmit` (workdir: `client/`)
- 結果:
  - 型エラーなし

## 補足
- gRPC フィールドエラーの名前揺れ (`draft.correct_ordinal` など) を route 内で吸収している。
- この実装は task 26 の「入力検証スキーマ統一」へつながる構成になっている。
