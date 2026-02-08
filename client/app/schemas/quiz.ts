// クイズ回答フォームの入力仕様とエラー正規化を定義する。

import { z } from "zod";
import { createRequiredTrimmedTextSchema } from "./common";

const QUESTION_ID_REQUIRED_MESSAGE = "問題IDの取得に失敗しました。ページを再読み込みしてください。";
const CHOICE_ID_REQUIRED_MESSAGE = "回答は必須です。";
const QUIZ_CHOICE_FIELD_NAMES = new Set(["choiceId", "selectedChoiceId", "selected_choice_id"]);

export const quizAnswerFormSchema = z.object({
  questionId: createRequiredTrimmedTextSchema(QUESTION_ID_REQUIRED_MESSAGE),
  choiceId: createRequiredTrimmedTextSchema(CHOICE_ID_REQUIRED_MESSAGE),
});

export type QuizAnswerFormValue = z.infer<typeof quizAnswerFormSchema>;

// resolveQuizChoiceFieldError は gRPC 由来の field 名の揺れを UI の choiceId エラーへ寄せる。
export function resolveQuizChoiceFieldError(fieldErrors: Record<string, string>): string | undefined {
  for (const [field, message] of Object.entries(fieldErrors)) {
    if (QUIZ_CHOICE_FIELD_NAMES.has(field)) {
      return message;
    }
  }
  return undefined;
}
