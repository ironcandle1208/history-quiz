// 問題作成フォームの入力仕様を定義する。
// Remix(action) 側の一次検証として使用し、バックエンド側検証の前段で UX を整える。

import { z } from "zod";
import { createRequiredTrimmedTextSchema } from "./common";

export const QUESTION_CHOICES_COUNT = 4;

const MAX_EXPLANATION_LENGTH = 500;
const CHOICE_FIELD_WITH_INDEX_PATTERN = /^draft\.choices\[(\d+)\]$/;
const CHOICE_FIELD_WITH_INDEX_FALLBACK_PATTERN = /^choices\[(\d+)\]$/;
const requiredText = createRequiredTrimmedTextSchema("必須です。");

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

// mapQuestionGrpcFieldToConformField はバックエンド由来の field 名を conform 側の name に揃える。
export function mapQuestionGrpcFieldToConformField(field: string): string | null {
  switch (field) {
    case "draft.prompt":
    case "prompt":
      return "prompt";
    case "draft.choices":
    case "choices":
      return "choices";
    case "draft.correct_ordinal":
    case "draft.correctOrdinal":
    case "correct_ordinal":
    case "correctOrdinal":
      return "correctOrdinal";
    case "draft.explanation":
    case "explanation":
      return "explanation";
    default: {
      const indexedChoiceMatch =
        field.match(CHOICE_FIELD_WITH_INDEX_PATTERN) ?? field.match(CHOICE_FIELD_WITH_INDEX_FALLBACK_PATTERN);
      if (indexedChoiceMatch) {
        return `choices[${indexedChoiceMatch[1]}]`;
      }
      return null;
    }
  }
}

// toQuestionConformFieldErrors は gRPC fieldErrors を conform.reply 形式へ変換する。
export function toQuestionConformFieldErrors(fieldErrors: Record<string, string>): Record<string, string[]> {
  const converted: Record<string, string[]> = {};
  for (const [field, message] of Object.entries(fieldErrors)) {
    const mappedField = mapQuestionGrpcFieldToConformField(field);
    if (!mappedField) {
      continue;
    }
    converted[mappedField] = [message];
  }
  return converted;
}
