// HTTP リクエストボディサイズの上限チェックを扱うサーバー専用サービス。
// 目的: 巨大な POST ボディを action の処理前に拒否し、不要な負荷を抑える。

import { json } from "@remix-run/node";

import { createRequestId } from "../grpc/client.server";

type AssertRequestContentLengthWithinLimitParams = {
  maxBytes: number;
  request: Request;
  requestId?: string;
};

// parseContentLengthHeader は Content-Length ヘッダを検証して数値へ変換する。
function parseContentLengthHeader(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return undefined;
  }

  if (!/^[0-9]+$/.test(normalized)) {
    return Number.NaN;
  }

  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

// resolveRequestId は既存IDが無ければ新規に requestId を払い出す。
function resolveRequestId(request: Request, requestId?: string): string {
  if (requestId && requestId.trim().length > 0) {
    return requestId.trim();
  }

  const requestHeaderId = request.headers.get("x-request-id");
  if (requestHeaderId && requestHeaderId.trim().length > 0) {
    return requestHeaderId.trim();
  }

  return createRequestId();
}

// assertRequestContentLengthWithinLimit は Content-Length が上限を超えるリクエストを 413 で拒否する。
export function assertRequestContentLengthWithinLimit(
  params: AssertRequestContentLengthWithinLimitParams,
): { requestId: string } {
  const requestId = resolveRequestId(params.request, params.requestId);
  const contentLength = parseContentLengthHeader(params.request.headers.get("Content-Length"));

  if (typeof contentLength === "undefined") {
    return { requestId };
  }

  if (!Number.isFinite(contentLength) || contentLength < 0) {
    throw json(
      {
        error: {
          code: "BAD_REQUEST",
          message: "Content-Length ヘッダが不正です。",
        },
        requestId,
      },
      {
        headers: { "x-request-id": requestId },
        status: 400,
      },
    );
  }

  if (contentLength > params.maxBytes) {
    throw json(
      {
        error: {
          code: "PAYLOAD_TOO_LARGE",
          message: `リクエストサイズが上限（${params.maxBytes} bytes）を超えています。`,
        },
        requestId,
      },
      {
        headers: { "x-request-id": requestId },
        status: 413,
      },
    );
  }

  return { requestId };
}
