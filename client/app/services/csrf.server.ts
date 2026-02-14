// CSRF トークンの発行・検証を扱うサーバー専用サービス。
// state-changing な POST action での共通防御として利用する。

import { timingSafeEqual } from "node:crypto";

import { json } from "@remix-run/node";

import { createRequestId } from "../grpc/client.server";
import { ensureSessionCsrfToken, getSessionCsrfToken } from "./session.server";

export const CSRF_TOKEN_FIELD_NAME = "csrfToken";

const CSRF_ERROR_MESSAGE = "セキュリティ検証に失敗しました。ページを再読み込みして再試行してください。";

// toOptionalTrimmedToken は FormData からトリム済みのトークン文字列を取得する。
function toOptionalTrimmedToken(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

// safeTokenEquals は timingSafeEqual を使ってトークン一致を検証する。
function safeTokenEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

// issueCsrfToken はセッション上の CSRF トークンを払い出し、必要に応じて Set-Cookie を返す。
export async function issueCsrfToken(request: Request): Promise<{ csrfToken: string; setCookie?: string }> {
  return ensureSessionCsrfToken(request);
}

// verifyCsrfToken は POST フォームの CSRF トークンを検証し、失敗時は 403 を throw する。
export async function verifyCsrfToken(params: {
  formData: FormData;
  request: Request;
  requestId?: string;
}): Promise<{ requestId: string }> {
  const requestId = params.requestId ?? createRequestId();
  const sessionToken = await getSessionCsrfToken(params.request);
  const postedToken = toOptionalTrimmedToken(params.formData.get(CSRF_TOKEN_FIELD_NAME));

  if (!sessionToken || !postedToken || !safeTokenEquals(sessionToken, postedToken)) {
    throw json(
      {
        error: {
          code: "FORBIDDEN",
          message: CSRF_ERROR_MESSAGE,
        },
        requestId,
      },
      {
        status: 403,
        headers: { "x-request-id": requestId },
      },
    );
  }

  return { requestId };
}
