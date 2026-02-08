import type { LoaderFunctionArgs } from "@remix-run/node";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  listMyAttemptsMock,
  getMyStatsMock,
  listMyQuestionsMock,
  createRequestIdMock,
  requireAuthenticatedUserMock,
} = vi.hoisted(() => ({
  listMyAttemptsMock: vi.fn(),
  getMyStatsMock: vi.fn(),
  listMyQuestionsMock: vi.fn(),
  createRequestIdMock: vi.fn(),
  requireAuthenticatedUserMock: vi.fn(),
}));

vi.mock("../../grpc/user.server", () => ({
  getMyStats: getMyStatsMock,
  listMyAttempts: listMyAttemptsMock,
}));

vi.mock("../../grpc/question.server", () => ({
  listMyQuestions: listMyQuestionsMock,
}));

vi.mock("../../grpc/client.server", () => ({
  createRequestId: createRequestIdMock,
}));

vi.mock("../../services/auth.server", () => ({
  requireAuthenticatedUser: requireAuthenticatedUserMock,
}));

import { loader } from "../../routes/me";

// createLoaderArgs は /me loader 実行用の引数を生成する。
function createLoaderArgs(url: string): LoaderFunctionArgs {
  return {
    context: {},
    params: {},
    request: new Request(url),
  } as LoaderFunctionArgs;
}

// toJson は Response の JSON ボディを型付きで返す。
async function toJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

describe("integration: /me", () => {
  beforeEach(() => {
    requireAuthenticatedUserMock.mockResolvedValue({ userId: "user-1" });
    createRequestIdMock.mockReturnValue("req-me-1");

    listMyAttemptsMock.mockResolvedValue({
      requestId: "req-attempts",
      response: {
        attempts: [
          {
            id: "attempt-1",
            isCorrect: true,
            questionId: "q-1",
            questionPrompt: "鎌倉幕府の成立年は？",
            selectedChoiceId: "c-1",
            answeredAt: "2026-02-08T00:00:00.000Z",
          },
          {
            id: "attempt-2",
            isCorrect: false,
            questionId: "q-2",
            questionPrompt: "大政奉還が行われた年は？",
            selectedChoiceId: "c-2",
            answeredAt: "2026-02-08T00:10:00.000Z",
          },
        ],
      },
    });

    getMyStatsMock.mockResolvedValue({
      requestId: "req-stats",
      response: {
        stats: {
          accuracy: 0.5,
          correctAttempts: "1",
          totalAttempts: "2",
        },
      },
    });

    listMyQuestionsMock.mockResolvedValue({
      requestId: "req-questions",
      response: {
        questions: [
          {
            id: "my-q-1",
            prompt: "明治維新の中心となった藩は？",
            updatedAt: "2026-02-08T00:15:00.000Z",
          },
        ],
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("履歴・統計・自作問題一覧を同じ requestId で取得できる", async () => {
    const response = await loader(createLoaderArgs("http://localhost/me"));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBe("req-me-1");

    const body = await toJson<{
      attempts: Array<{ id: string }>;
      questions: Array<{ id: string }>;
      requestId: string;
      stats: { accuracy: number; correctAttempts: string; totalAttempts: string };
      userId: string;
    }>(response);

    expect(body.requestId).toBe("req-me-1");
    expect(body.userId).toBe("user-1");
    expect(body.attempts).toHaveLength(2);
    expect(body.questions).toHaveLength(1);
    expect(body.stats).toEqual({
      accuracy: 0.5,
      correctAttempts: "1",
      totalAttempts: "2",
    });

    expect(listMyAttemptsMock).toHaveBeenCalledWith({
      callContext: { requestId: "req-me-1", userId: "user-1" },
      request: {
        pagination: { pageSize: 20 },
      },
    });
    expect(getMyStatsMock).toHaveBeenCalledWith({
      callContext: { requestId: "req-me-1", userId: "user-1" },
      request: {},
    });
    expect(listMyQuestionsMock).toHaveBeenCalledWith({
      callContext: { requestId: "req-me-1", userId: "user-1" },
      request: {
        pagination: { pageSize: 20 },
      },
    });
  });
});
