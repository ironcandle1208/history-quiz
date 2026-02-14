import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getQuestionMock, submitAnswerMock, getUserMock, issueCsrfTokenMock, verifyCsrfTokenMock } = vi.hoisted(() => ({
  getQuestionMock: vi.fn(),
  submitAnswerMock: vi.fn(),
  getUserMock: vi.fn(),
  issueCsrfTokenMock: vi.fn(),
  verifyCsrfTokenMock: vi.fn(),
}));

vi.mock("../../grpc/quiz.server", () => ({
  getQuestion: getQuestionMock,
  submitAnswer: submitAnswerMock,
}));

vi.mock("../../services/session.server", () => ({
  getUser: getUserMock,
}));

vi.mock("../../services/csrf.server", () => ({
  CSRF_TOKEN_FIELD_NAME: "csrfToken",
  issueCsrfToken: issueCsrfTokenMock,
  verifyCsrfToken: verifyCsrfTokenMock,
}));

import { action, loader } from "../../routes/quiz";

// createLoaderArgs は quiz loader 呼び出し用の引数を生成する。
function createLoaderArgs(url: string): LoaderFunctionArgs {
  return {
    context: {},
    params: {},
    request: new Request(url),
  } as LoaderFunctionArgs;
}

// createActionArgs は quiz action 呼び出し用の POST 引数を生成する。
function createActionArgs(url: string, fields: Record<string, string>): ActionFunctionArgs {
  const formData = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }

  return {
    context: {},
    params: {},
    request: new Request(url, {
      body: formData,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      method: "POST",
    }),
  } as ActionFunctionArgs;
}

// toJson は Response の JSON ボディを型付きで読み出す。
async function toJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

describe("integration: /quiz", () => {
  beforeEach(() => {
    getUserMock.mockResolvedValue({ userId: "user-1" });
    issueCsrfTokenMock.mockResolvedValue({ csrfToken: "csrf-test-token" });
    verifyCsrfTokenMock.mockResolvedValue({ requestId: "req-csrf-test" });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("出題→回答→次へのフローで gRPC 連携が成立する", async () => {
    getQuestionMock.mockResolvedValueOnce({
      requestId: "req-get-1",
      response: {
        question: {
          id: "q-1",
          prompt: "日本の首都はどこ？",
          choices: [
            { id: "c-1", label: "東京", ordinal: 0 },
            { id: "c-2", label: "大阪", ordinal: 1 },
            { id: "c-3", label: "名古屋", ordinal: 2 },
            { id: "c-4", label: "福岡", ordinal: 3 },
          ],
          explanation: "東京は日本の首都です。",
        },
      },
    });

    const firstQuestionResponse = await loader(createLoaderArgs("http://localhost/quiz"));
    expect(firstQuestionResponse.status).toBe(200);
    expect(firstQuestionResponse.headers.get("x-request-id")).toBe("req-get-1");

    const firstQuestionBody = await toJson<{ question: { id: string } }>(firstQuestionResponse);
    expect(firstQuestionBody.question.id).toBe("q-1");
    expect(getQuestionMock).toHaveBeenCalledWith({
      callContext: { userId: "user-1" },
      request: { previousQuestionId: undefined },
    });

    submitAnswerMock.mockResolvedValueOnce({
      requestId: "req-submit-1",
      response: {
        attemptId: "attempt-1",
        correctChoiceId: "c-1",
        isCorrect: false,
      },
    });

    const answerResponse = await action(
      createActionArgs("http://localhost/quiz", {
        choiceId: "c-2",
        questionId: "q-1",
      }),
    );
    expect(answerResponse.status).toBe(200);
    expect(answerResponse.headers.get("x-request-id")).toBe("req-submit-1");

    const answerBody = await toJson<{
      ok: boolean;
      result: { isCorrect: boolean; questionId: string; selectedChoiceId: string };
    }>(answerResponse);
    expect(answerBody.ok).toBe(true);
    expect(answerBody.result.isCorrect).toBe(false);
    expect(answerBody.result.questionId).toBe("q-1");
    expect(answerBody.result.selectedChoiceId).toBe("c-2");
    expect(submitAnswerMock).toHaveBeenCalledWith({
      callContext: { requestId: "req-csrf-test", userId: "user-1" },
      request: {
        questionId: "q-1",
        selectedChoiceId: "c-2",
      },
    });

    getQuestionMock.mockResolvedValueOnce({
      requestId: "req-get-2",
      response: {
        question: {
          id: "q-2",
          prompt: "平安京が置かれた都市は？",
          choices: [
            { id: "c2-1", label: "京都", ordinal: 0 },
            { id: "c2-2", label: "奈良", ordinal: 1 },
            { id: "c2-3", label: "鎌倉", ordinal: 2 },
            { id: "c2-4", label: "江戸", ordinal: 3 },
          ],
          explanation: "平安京は京都に置かれました。",
        },
      },
    });

    const nextQuestionResponse = await loader(
      createLoaderArgs("http://localhost/quiz?previousQuestionId=q-1"),
    );
    expect(nextQuestionResponse.status).toBe(200);
    expect(nextQuestionResponse.headers.get("x-request-id")).toBe("req-get-2");

    const nextQuestionBody = await toJson<{ question: { id: string } }>(nextQuestionResponse);
    expect(nextQuestionBody.question.id).toBe("q-2");
    expect(getQuestionMock).toHaveBeenLastCalledWith({
      callContext: { userId: "user-1" },
      request: { previousQuestionId: "q-1" },
    });
  });
});
