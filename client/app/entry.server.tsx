// サーバー側のエントリポイント（Remix 標準）。
// NOTE: ストリーミングを使う場合でも、基本はこの形を踏襲する。

import { PassThrough } from "node:stream";

import { RemixServer } from "@remix-run/react";
import { createReadableStreamFromReadable, type EntryContext } from "@remix-run/node";
import { renderToPipeableStream } from "react-dom/server";

const ABORT_DELAY_MS = 5_000;

// handleRequest は Remix が HTTP リクエストを受けた際の SSR 処理を行う。
export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext
) {
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

          pipe(body);
        },
        onShellError(error) {
          reject(error);
        },
        onError(error) {
          didError = true;
          console.error(error);
        },
      }
    );

    setTimeout(abort, ABORT_DELAY_MS);
  });
}
