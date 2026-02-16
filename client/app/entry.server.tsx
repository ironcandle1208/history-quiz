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
