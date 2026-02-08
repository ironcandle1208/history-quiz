# Task22: クイズ画面（取得→回答→判定→次へ）実装

## 実施日時
- 2026-02-08 12:31

## 背景
- `docs/tasks.md` の未完了タスク 22（クイズ画面）を完了する必要があった。
- 既存の `client/app/routes/quiz.tsx` はダミーデータのみで、gRPC 連携・正誤表示・次へ導線が未実装だった。

## 変更内容
1. `client/app/routes/quiz.tsx`
- `loader` で `QuizService/GetQuestion` を呼び出す実装へ置き換えた。
- `action` で `QuizService/SubmitAnswer` を呼び出し、正誤判定結果を返すようにした。
- 回答後に「正解/不正解」「正解の選択肢（不正解時）」「解説」を表示するようにした。
- 回答後に `previousQuestionId` を付けて再取得する「次の問題へ」導線を追加した。
- gRPC 失敗時は `normalizeGrpcHttpError` / `throwGrpcErrorResponse` を利用し、共通エラー形式に揃えた。
- `ErrorBoundary` を追加し、loader 失敗時にもユーザーへ再試行導線を出せるようにした。

2. `client/app/grpc/client.server.ts`
- クイズを未ログインでも遊べるように、`GrpcCallContext.userId` を任意化した。
- `userId` が空の場合は `x-user-id` metadata を送らない実装に変更した。

3. `docs/tasks.md`
- タスク 22 を完了（`[x]`）に更新した。

## 設計上の意図
- 要件 1/2 の「即時判定」「次の問題へ遷移」を Route 単体で完結させ、後続タスク（作問/マイページ）と独立に進められる状態にした。
- クイズは匿名利用を許可するバックエンド設計に合わせ、BFF 側も未ログインを許容する形に揃えた。

## 動作確認
- `pnpm --dir client build`

## 変更ファイル
- `client/app/routes/quiz.tsx`
- `client/app/grpc/client.server.ts`
- `docs/tasks.md`
- `.walkthrough/202602081231_walkthrough_task22_quiz_route_get_submit_next.md`
