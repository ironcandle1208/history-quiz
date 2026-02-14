import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  beginOidcAuthorizationMock,
  completeOidcAuthorizationMock,
  createQuestionMock,
  getMyStatsMock,
  getQuestionMock,
  listMyAttemptsMock,
  listMyQuestionsMock,
  submitAnswerMock,
  createRequestIdMock,
  issueCsrfTokenMock,
  verifyCsrfTokenMock,
} = vi.hoisted(() => ({
  beginOidcAuthorizationMock: vi.fn(),
  completeOidcAuthorizationMock: vi.fn(),
  createQuestionMock: vi.fn(),
  getMyStatsMock: vi.fn(),
  getQuestionMock: vi.fn(),
  listMyAttemptsMock: vi.fn(),
  listMyQuestionsMock: vi.fn(),
  submitAnswerMock: vi.fn(),
  createRequestIdMock: vi.fn(),
  issueCsrfTokenMock: vi.fn(),
  verifyCsrfTokenMock: vi.fn(),
}));

vi.mock("../../app/services/oidc.server", () => ({
  OidcFlowError: class OidcFlowError extends Error {
    // status を持つ最小実装の OIDC 例外モック。
    constructor(
      message: string,
      public readonly status = 500,
    ) {
      super(message);
      this.name = "OidcFlowError";
    }
  },
  beginOidcAuthorization: beginOidcAuthorizationMock,
  completeOidcAuthorization: completeOidcAuthorizationMock,
}));

vi.mock("../../app/grpc/question.server", () => ({
  createQuestion: createQuestionMock,
  listMyQuestions: listMyQuestionsMock,
}));

vi.mock("../../app/grpc/quiz.server", () => ({
  getQuestion: getQuestionMock,
  submitAnswer: submitAnswerMock,
}));

vi.mock("../../app/grpc/user.server", () => ({
  getMyStats: getMyStatsMock,
  listMyAttempts: listMyAttemptsMock,
}));

vi.mock("../../app/grpc/client.server", () => ({
  createRequestId: createRequestIdMock,
}));

vi.mock("../../app/services/csrf.server", () => ({
  CSRF_TOKEN_FIELD_NAME: "csrfToken",
  issueCsrfToken: issueCsrfTokenMock,
  verifyCsrfToken: verifyCsrfTokenMock,
}));

import { loader as authCallbackLoader } from "../../app/routes/auth.callback";
import { loader as loginLoader } from "../../app/routes/login";
import { loader as meLoader } from "../../app/routes/me";
import { action as createQuestionAction } from "../../app/routes/questions.new";
import { action as quizAction, loader as quizLoader } from "../../app/routes/quiz";

type StoredQuestion = {
  id: string;
  prompt: string;
  choices: string[];
  correctOrdinal: number;
  explanation: string;
  updatedAt: string;
};

type StoredAttempt = {
  id: string;
  isCorrect: boolean;
  questionId: string;
  questionPrompt: string;
  selectedChoiceId: string;
  answeredAt: string;
};

// createLoaderArgs は loader 呼び出し用に Request を生成する。
function createLoaderArgs(params: { cookie?: string; url: string }): LoaderFunctionArgs {
  const headers = new Headers();
  if (params.cookie) {
    headers.set("Cookie", params.cookie);
  }

  return {
    context: {},
    params: {},
    request: new Request(params.url, {
      headers,
      method: "GET",
    }),
  } as LoaderFunctionArgs;
}

// createActionArgs は action 呼び出し用の POST Request を生成する。
function createActionArgs(params: {
  cookie?: string;
  entries: Array<[string, string]>;
  url: string;
}): ActionFunctionArgs {
  const formData = new URLSearchParams();
  for (const [key, value] of params.entries) {
    formData.append(key, value);
  }

  const headers = new Headers({
    "Content-Type": "application/x-www-form-urlencoded",
  });
  if (params.cookie) {
    headers.set("Cookie", params.cookie);
  }

  return {
    context: {},
    params: {},
    request: new Request(params.url, {
      body: formData,
      headers,
      method: "POST",
    }),
  } as ActionFunctionArgs;
}

// toJson は Response の JSON ボディを型付きで読み出す。
async function toJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

// extractCookieValue は Set-Cookie 文字列から Cookie 本体を取り出す。
function extractCookieValue(setCookie: string | null): string {
  if (!setCookie) {
    return "";
  }

  const matched = setCookie.match(/^[^;]+/);
  return matched?.[0] ?? "";
}

// extractRedirectResponse は loader が throw した redirect Response を安全に取り出す。
function extractRedirectResponse(error: unknown): Response {
  if (error instanceof Response) {
    return error;
  }

  throw error;
}

describe("e2e: 主要導線（route scenario）", () => {
  beforeEach(() => {
    const questions = new Map<string, StoredQuestion>();
    const attempts: StoredAttempt[] = [];

    let requestSequence = 1;
    let questionSequence = 1;
    let attemptSequence = 1;

    createRequestIdMock.mockImplementation(() => `req-e2e-${requestSequence++}`);
    issueCsrfTokenMock.mockResolvedValue({ csrfToken: "csrf-test-token" });
    verifyCsrfTokenMock.mockResolvedValue({ requestId: "req-csrf-test" });

    beginOidcAuthorizationMock.mockImplementation(async (params: { redirectTo: string }) => ({
      authorizationUrl: "https://mock-oidc.local/authorize?state=state-e2e-1",
      pendingAuth: {
        codeVerifier: "code-verifier-e2e-1",
        nonce: "nonce-e2e-1",
        redirectTo: params.redirectTo,
        state: "state-e2e-1",
      },
    }));

    completeOidcAuthorizationMock.mockResolvedValue({ subject: "e2e-user-1" });

    createQuestionMock.mockImplementation(async (params: {
      request: {
        draft: {
          choices: string[];
          correctOrdinal: number;
          explanation?: string;
          prompt: string;
        };
      };
    }) => {
      const id = `q-${questionSequence++}`;
      const question: StoredQuestion = {
        choices: [...params.request.draft.choices],
        correctOrdinal: params.request.draft.correctOrdinal,
        explanation: params.request.draft.explanation ?? "",
        id,
        prompt: params.request.draft.prompt,
        updatedAt: "2026-02-08T00:00:00.000Z",
      };
      questions.set(id, question);

      return {
        requestId: "req-create",
        response: {
          question: {
            choices: question.choices.map((label, index) => ({
              id: `${id}-choice-${index}`,
              label,
              ordinal: index,
            })),
            correctChoiceId: `${id}-choice-${question.correctOrdinal}`,
            explanation: question.explanation,
            id,
            prompt: question.prompt,
            updatedAt: question.updatedAt,
          },
        },
      };
    });

    getQuestionMock.mockImplementation(async () => {
      const first = [...questions.values()][0] ?? {
        choices: ["鎌倉", "京都", "奈良", "江戸"],
        correctOrdinal: 1,
        explanation: "平安京は京都です。",
        id: "default-q-1",
        prompt: "平安京が置かれた都市は？",
        updatedAt: "2026-02-08T00:00:00.000Z",
      };

      return {
        requestId: "req-get-question",
        response: {
          question: {
            choices: first.choices.map((label, index) => ({
              id: `${first.id}-choice-${index}`,
              label,
              ordinal: index,
            })),
            explanation: first.explanation,
            id: first.id,
            prompt: first.prompt,
          },
        },
      };
    });

    submitAnswerMock.mockImplementation(async (params: { request: { questionId: string; selectedChoiceId: string } }) => {
      const question = questions.get(params.request.questionId);
      const correctChoiceId = question
        ? `${question.id}-choice-${question.correctOrdinal}`
        : `${params.request.questionId}-choice-1`;
      const isCorrect = params.request.selectedChoiceId === correctChoiceId;

      attempts.unshift({
        answeredAt: "2026-02-08T00:10:00.000Z",
        id: `attempt-${attemptSequence++}`,
        isCorrect,
        questionId: params.request.questionId,
        questionPrompt: question?.prompt ?? "平安京が置かれた都市は？",
        selectedChoiceId: params.request.selectedChoiceId,
      });

      return {
        requestId: "req-submit",
        response: {
          attemptId: attempts[0].id,
          correctChoiceId,
          isCorrect,
        },
      };
    });

    listMyQuestionsMock.mockImplementation(async () => ({
      requestId: "req-list-questions",
      response: {
        questions: [...questions.values()].map((question) => ({
          id: question.id,
          prompt: question.prompt,
          updatedAt: question.updatedAt,
        })),
      },
    }));

    listMyAttemptsMock.mockImplementation(async () => ({
      requestId: "req-list-attempts",
      response: {
        attempts: [...attempts],
      },
    }));

    getMyStatsMock.mockImplementation(async () => {
      const total = attempts.length;
      const correct = attempts.filter((attempt) => attempt.isCorrect).length;
      return {
        requestId: "req-stats",
        response: {
          stats: {
            accuracy: total > 0 ? correct / total : 0,
            correctAttempts: String(correct),
            totalAttempts: String(total),
          },
        },
      };
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("ログイン→作問→クイズ→マイページの導線が成立する", async () => {
    let redirectResponse: Response;
    try {
      await meLoader(createLoaderArgs({ url: "http://localhost/me" }));
      throw new Error("未認証時に /me がリダイレクトされませんでした。");
    } catch (error) {
      redirectResponse = extractRedirectResponse(error);
    }

    expect(redirectResponse.status).toBe(302);
    const redirectLocation = redirectResponse.headers.get("Location") ?? "";
    expect(redirectLocation).toContain("/login?redirectTo=%2Fme");

    const loginResponse = await loginLoader(
      createLoaderArgs({
        url: `http://localhost${redirectLocation}`,
      }),
    );
    expect(loginResponse.status).toBe(302);
    expect(loginResponse.headers.get("Location")).toContain("https://mock-oidc.local/authorize");
    const pendingSessionCookie = extractCookieValue(loginResponse.headers.get("Set-Cookie"));
    expect(pendingSessionCookie).toContain("history_quiz_session=");

    const callbackResponse = await authCallbackLoader(
      createLoaderArgs({
        cookie: pendingSessionCookie,
        url: "http://localhost/auth/callback?code=mock-code&state=state-e2e-1",
      }),
    );
    expect(callbackResponse.status).toBe(302);
    expect(callbackResponse.headers.get("Location")).toBe("/me");
    const authenticatedCookie = extractCookieValue(callbackResponse.headers.get("Set-Cookie"));
    expect(authenticatedCookie).toContain("history_quiz_session=");

    const loggedInLoginResponse = await loginLoader(
      createLoaderArgs({
        cookie: authenticatedCookie,
        url: "http://localhost/login",
      }),
    );
    expect(loggedInLoginResponse.status).toBe(200);
    const loggedInLoginBody = await toJson<{ isLoggedIn: boolean; userId?: string }>(loggedInLoginResponse);
    expect(loggedInLoginBody.isLoggedIn).toBe(true);
    expect(loggedInLoginBody.userId).toBe("e2e-user-1");

    const createResponse = await createQuestionAction(
      createActionArgs({
        cookie: authenticatedCookie,
        entries: [
          ["prompt", "江戸幕府を開いた人物は？"],
          ["choices", "徳川家康"],
          ["choices", "織田信長"],
          ["choices", "豊臣秀吉"],
          ["choices", "足利尊氏"],
          ["correctOrdinal", "0"],
          ["explanation", "江戸幕府を開いたのは徳川家康です。"],
        ],
        url: "http://localhost/questions/new",
      }),
    );
    expect(createResponse.status).toBe(200);
    const createBody = await toJson<{ ok: boolean; question: { id: string; prompt: string } }>(createResponse);
    expect(createBody.ok).toBe(true);
    expect(createBody.question.prompt).toBe("江戸幕府を開いた人物は？");

    const quizQuestionResponse = await quizLoader(
      createLoaderArgs({
        cookie: authenticatedCookie,
        url: "http://localhost/quiz",
      }),
    );
    expect(quizQuestionResponse.status).toBe(200);
    const quizQuestionBody = await toJson<{ question: { choices: Array<{ id: string }>; id: string } }>(quizQuestionResponse);
    const selectedChoiceId = quizQuestionBody.question.choices[0]?.id;
    expect(selectedChoiceId).toBeTruthy();

    const submitResponse = await quizAction(
      createActionArgs({
        cookie: authenticatedCookie,
        entries: [
          ["questionId", quizQuestionBody.question.id],
          ["choiceId", selectedChoiceId ?? ""],
        ],
        url: "http://localhost/quiz",
      }),
    );
    expect(submitResponse.status).toBe(200);
    const submitBody = await toJson<{ ok: boolean; result: { questionId: string; selectedChoiceId: string } }>(submitResponse);
    expect(submitBody.ok).toBe(true);
    expect(submitBody.result.questionId).toBe(quizQuestionBody.question.id);
    expect(submitBody.result.selectedChoiceId).toBe(selectedChoiceId);

    const meResponse = await meLoader(
      createLoaderArgs({
        cookie: authenticatedCookie,
        url: "http://localhost/me",
      }),
    );
    expect(meResponse.status).toBe(200);
    const meBody = await toJson<{
      attempts: Array<{ id: string; questionId: string }>;
      questions: Array<{ id: string; prompt: string }>;
      stats: { correctAttempts: string; totalAttempts: string };
      userId: string;
    }>(meResponse);

    expect(meBody.userId).toBe("e2e-user-1");
    expect(meBody.questions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: createBody.question.id,
          prompt: "江戸幕府を開いた人物は？",
        }),
      ]),
    );
    expect(meBody.attempts).toHaveLength(1);
    expect(meBody.stats.totalAttempts).toBe("1");

    expect(beginOidcAuthorizationMock).toHaveBeenCalledTimes(1);
    expect(completeOidcAuthorizationMock).toHaveBeenCalledTimes(1);
    expect(createQuestionMock).toHaveBeenCalledTimes(1);
    expect(getQuestionMock).toHaveBeenCalledTimes(1);
    expect(submitAnswerMock).toHaveBeenCalledTimes(1);
    expect(listMyAttemptsMock).toHaveBeenCalledTimes(1);
    expect(getMyStatsMock).toHaveBeenCalledTimes(1);
    expect(listMyQuestionsMock).toHaveBeenCalledTimes(1);
  });
});
