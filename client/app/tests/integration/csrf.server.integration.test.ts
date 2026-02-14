import { describe, expect, it } from "vitest";

import { CSRF_TOKEN_FIELD_NAME, issueCsrfToken, verifyCsrfToken } from "../../services/csrf.server";

// extractCookieValue は Set-Cookie 文字列から Cookie ヘッダへ再利用可能な値を抜き出す。
function extractCookieValue(setCookie: string | null | undefined): string {
  if (!setCookie) {
    return "";
  }

  const matched = setCookie.match(/^[^;]+/);
  return matched?.[0] ?? "";
}

// createRequestWithCookie は必要に応じて Cookie 付き Request を生成する。
function createRequestWithCookie(url: string, cookie?: string): Request {
  const headers = new Headers();
  if (cookie && cookie.length > 0) {
    headers.set("Cookie", cookie);
  }

  return new Request(url, {
    headers,
    method: "POST",
  });
}

describe("integration: csrf.server", () => {
  it("issueCsrfToken は初回生成し、同一セッションでは同じ値を再利用する", async () => {
    const firstIssue = await issueCsrfToken(new Request("http://localhost/quiz"));

    expect(firstIssue.csrfToken.length).toBeGreaterThan(0);
    expect(firstIssue.setCookie).toContain("history_quiz_session=");

    const cookie = extractCookieValue(firstIssue.setCookie);
    const secondIssue = await issueCsrfToken(new Request("http://localhost/quiz", { headers: { Cookie: cookie } }));

    expect(secondIssue.csrfToken).toBe(firstIssue.csrfToken);
    expect(secondIssue.setCookie).toBeUndefined();
  });

  it("verifyCsrfToken は一致時に requestId を返す", async () => {
    const issued = await issueCsrfToken(new Request("http://localhost/questions/new"));
    const cookie = extractCookieValue(issued.setCookie);

    const formData = new FormData();
    formData.set(CSRF_TOKEN_FIELD_NAME, issued.csrfToken);

    const verified = await verifyCsrfToken({
      formData,
      request: createRequestWithCookie("http://localhost/questions/new", cookie),
      requestId: "req-csrf-valid",
    });

    expect(verified).toEqual({ requestId: "req-csrf-valid" });
  });

  it("verifyCsrfToken は不一致時に 403 と requestId を返す", async () => {
    const issued = await issueCsrfToken(new Request("http://localhost/quiz"));
    const cookie = extractCookieValue(issued.setCookie);

    const formData = new FormData();
    formData.set(CSRF_TOKEN_FIELD_NAME, "invalid-token");

    let thrown: unknown;
    try {
      await verifyCsrfToken({
        formData,
        request: createRequestWithCookie("http://localhost/quiz", cookie),
        requestId: "req-csrf-invalid",
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Response);
    const response = thrown as Response;
    expect(response.status).toBe(403);
    expect(response.headers.get("x-request-id")).toBe("req-csrf-invalid");

    const body = (await response.json()) as {
      error: { code: string; message: string };
      requestId: string;
    };
    expect(body.error.code).toBe("FORBIDDEN");
    expect(body.requestId).toBe("req-csrf-invalid");
  });
});
