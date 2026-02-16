import { describe, expect, it } from "vitest";

import { assertRequestContentLengthWithinLimit } from "../../services/request-size.server";

// createPostRequest は Content-Length を任意指定した POST リクエストを生成する。
function createPostRequest(params: { body?: string; contentLength?: string; requestId?: string }): Request {
  const headers = new Headers();
  if (typeof params.contentLength === "string") {
    headers.set("Content-Length", params.contentLength);
  }
  if (typeof params.requestId === "string") {
    headers.set("x-request-id", params.requestId);
  }

  return new Request("http://localhost/quiz", {
    body: params.body ?? "",
    headers,
    method: "POST",
  });
}

describe("integration: request-size.server", () => {
  it("上限以内の Content-Length は許可する", () => {
    const result = assertRequestContentLengthWithinLimit({
      maxBytes: 1024,
      request: createPostRequest({ body: "ok", contentLength: "2", requestId: "req-size-ok" }),
    });

    expect(result).toEqual({ requestId: "req-size-ok" });
  });

  it("上限超過の Content-Length は 413 を返す", async () => {
    let thrown: unknown;

    try {
      assertRequestContentLengthWithinLimit({
        maxBytes: 32,
        request: createPostRequest({ body: "x", contentLength: "128", requestId: "req-size-too-large" }),
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Response);
    const response = thrown as Response;
    expect(response.status).toBe(413);
    expect(response.headers.get("x-request-id")).toBe("req-size-too-large");

    const body = (await response.json()) as {
      error: { code: string; message: string };
      requestId: string;
    };
    expect(body.error.code).toBe("PAYLOAD_TOO_LARGE");
    expect(body.requestId).toBe("req-size-too-large");
  });

  it("不正な Content-Length は 400 を返す", async () => {
    let thrown: unknown;

    try {
      assertRequestContentLengthWithinLimit({
        maxBytes: 32,
        request: createPostRequest({ body: "x", contentLength: "1.5", requestId: "req-size-invalid-header" }),
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Response);
    const response = thrown as Response;
    expect(response.status).toBe(400);
    expect(response.headers.get("x-request-id")).toBe("req-size-invalid-header");

    const body = (await response.json()) as {
      error: { code: string; message: string };
      requestId: string;
    };
    expect(body.error.code).toBe("BAD_REQUEST");
    expect(body.requestId).toBe("req-size-invalid-header");
  });
});
