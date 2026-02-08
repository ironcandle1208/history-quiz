// 問題作成フォームの入力仕様を定義する。
// Remix(action) 側の一次検証として使用し、バックエンド側検証の前段で UX を整える。

import { z } from "zod";

export const QUESTION_CHOICES_COUNT = 4;

const MAX_EXPLANATION_LENGTH = 500;
const requiredText = z.string().trim().min(1, "必須です。");

export const createQuestionFormSchema = z.object({
  prompt: requiredText,
  choices: z.array(requiredText).length(QUESTION_CHOICES_COUNT, "選択肢は4件入力してください。"),
  correctOrdinal: z.coerce
    .number()
    .refine((value) => Number.isInteger(value), { message: "正解の選択肢を選択してください。" })
    .min(0, "正解の選択肢を選択してください。")
    .max(QUESTION_CHOICES_COUNT - 1, "正解の選択肢を選択してください。"),
  explanation: z
    .string()
    .trim()
    .max(MAX_EXPLANATION_LENGTH, `解説は${MAX_EXPLANATION_LENGTH}文字以内で入力してください。`)
    .optional()
    .transform((value) => value ?? ""),
});

export type CreateQuestionFormValue = z.infer<typeof createQuestionFormSchema>;
