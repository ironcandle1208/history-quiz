// 入力スキーマの共通部品を提供する。

import { z } from "zod";

// createRequiredTrimmedTextSchema は未入力を同一メッセージで扱う必須文字列スキーマを返す。
export function createRequiredTrimmedTextSchema(message: string) {
  return z.preprocess(
    (value) => (typeof value === "string" ? value : ""),
    z.string().trim().min(1, message),
  );
}
