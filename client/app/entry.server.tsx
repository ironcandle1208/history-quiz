// サーバー側のエントリポイント（Remix 標準）。
// NOTE: ストリーミングを使う場合でも、基本はこの形を踏襲する。

import { PassThrough } from "node:stream";

import { RemixServer } from "@remix-run/react";
import { createReadableStreamFromReadable, type EntryContext } from "@remix-run/node";
import { renderToPipeableStream } from "react-dom/server";

import {
  ensureObservabilityReporterStarted,
  observeHttpRequest,
  observeServerFault,
} from "./services/observability.server";

const ABORT_DELAY_MS = 5_000;
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "form-action 'self'",
].join("; ");

// applySecurityHeaders は全レスポンスへ共通セキュリティヘッダを付与する。
function applySecurityHeaders(headers: Headers): void {
  headers.set("Content-Security-Policy", CONTENT_SECURITY_POLICY);
  headers.set("X-Frame-Options", "DENY");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
}

// handleRequest は Remix が HTTP リクエストを受けた際の SSR 処理を行う。
export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext
) {
  ensureObservabilityReporterStarted();
  const startedAtMs = Date.now();
  let hasLoggedAccess = false;

  // logHttpAccessOnce は SSR 1リクエストにつき1回だけアクセスログを出力する。
  const logHttpAccessOnce = (status: number, headers?: Headers) => {
    if (hasLoggedAccess) {
      return;
    }
    hasLoggedAccess = true;
    observeHttpRequest({
      request,
      requestId:
        headers?.get("x-request-id") ??
        responseHeaders.get("x-request-id") ??
        request.headers.get("x-request-id") ??
        undefined,
      responseStatus: status,
      startedAtMs,
    });
  };

  // NOTE: Response は Web 標準のグローバルを利用する（Node 18+）。
  return new Promise<Response>((resolve, reject) => {
    let didError = false;

    const { pipe, abort } = renderToPipeableStream(
      <RemixServer context={remixContext} url={request.url} />,
      {
        onShellReady() {
          const body = new PassThrough();
          // NOTE: Node.js の Readable を Web の ReadableStream に変換し、Response の型と実装に合わせる。
          const stream = createReadableStreamFromReadable(body);

          applySecurityHeaders(responseHeaders);
          responseHeaders.set("Content-Type", "text/html; charset=utf-8");

          resolve(
            new Response(stream, {
              status: didError ? 500 : responseStatusCode,
              headers: responseHeaders,
            })
          );

          logHttpAccessOnce(didError ? 500 : responseStatusCode, responseHeaders);

          pipe(body);
        },
        onShellError(error) {
          observeServerFault({
            detail: error,
            message: "SSR のシェル生成に失敗しました。",
            requestId:
              responseHeaders.get("x-request-id") ?? request.headers.get("x-request-id") ?? undefined,
            source: "entry.server:onShellError",
          });
          logHttpAccessOnce(500, responseHeaders);
          reject(error);
        },
        onError(error) {
          didError = true;
          observeServerFault({
            detail: error,
            message: "SSR レンダリング中にエラーが発生しました。",
            requestId:
              responseHeaders.get("x-request-id") ?? request.headers.get("x-request-id") ?? undefined,
            source: "entry.server:onError",
          });
        },
      }
    );

    setTimeout(abort, ABORT_DELAY_MS);
  });
}
