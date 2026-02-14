import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  createQuestionMock,
  getMyQuestionMock,
  listMyQuestionsMock,
  updateQuestionMock,
  listMyAttemptsMock,
  getMyStatsMock,
  createRequestIdMock,
  requireAuthenticatedUserMock,
  issueCsrfTokenMock,
  verifyCsrfTokenMock,
} = vi.hoisted(() => ({
  createQuestionMock: vi.fn(),
  getMyQuestionMock: vi.fn(),
  listMyQuestionsMock: vi.fn(),
  updateQuestionMock: vi.fn(),
  listMyAttemptsMock: vi.fn(),
  getMyStatsMock: vi.fn(),
  createRequestIdMock: vi.fn(),
  requireAuthenticatedUserMock: vi.fn(),
  issueCsrfTokenMock: vi.fn(),
  verifyCsrfTokenMock: vi.fn(),
}));

vi.mock("../../grpc/question.server", () => ({
  createQuestion: createQuestionMock,
  getMyQuestion: getMyQuestionMock,
  listMyQuestions: listMyQuestionsMock,
  updateQuestion: updateQuestionMock,
}));

vi.mock("../../grpc/user.server", () => ({
  getMyStats: getMyStatsMock,
  listMyAttempts: listMyAttemptsMock,
}));

vi.mock("../../grpc/client.server", () => ({
  createRequestId: createRequestIdMock,
}));

vi.mock("../../services/auth.server", () => ({
  requireAuthenticatedUser: requireAuthenticatedUserMock,
}));

vi.mock("../../services/csrf.server", () => ({
  CSRF_TOKEN_FIELD_NAME: "csrfToken",
  issueCsrfToken: issueCsrfTokenMock,
  verifyCsrfToken: verifyCsrfTokenMock,
}));

import { action as createQuestionAction } from "../../routes/questions.new";
import { action as editQuestionAction, loader as editQuestionLoader } from "../../routes/questions.$id.edit";
import { loader as meLoader } from "../../routes/me";

type StoredQuestion = {
  choices: string[];
  correctOrdinal: number;
  explanation: string;
  id: string;
  prompt: string;
  updatedAt: string;
};

// toQuestionDetailResponse はモック用の保存データを gRPC 応答形式へ変換する。
function toQuestionDetailResponse(question: StoredQuestion) {
  return {
    id: question.id,
    prompt: question.prompt,
    choices: question.choices.map((label, index) => ({
      id: `${question.id}-choice-${index}`,
      label,
      ordinal: index,
    })),
    correctChoiceId: `${question.id}-choice-${question.correctOrdinal}`,
    explanation: question.explanation,
    updatedAt: question.updatedAt,
  };
}

// toQuestionSummaryResponse は問題一覧表示向けの簡易データに変換する。
function toQuestionSummaryResponse(question: StoredQuestion) {
  return {
    id: question.id,
    prompt: question.prompt,
    updatedAt: question.updatedAt,
  };
}

// createLoaderArgs は loader 呼び出し用の引数を作成する。
function createLoaderArgs(url: string, params: Record<string, string | undefined> = {}): LoaderFunctionArgs {
  return {
    context: {},
    params,
    request: new Request(url),
  } as LoaderFunctionArgs;
}

// createFormRequest は x-www-form-urlencoded の POST リクエストを生成する。
function createFormRequest(url: string, entries: Array<[string, string]>): Request {
  const formData = new URLSearchParams();
  for (const [key, value] of entries) {
    formData.append(key, value);
  }

  return new Request(url, {
    body: formData,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });
}

// createActionArgs は action 呼び出し用の引数を作成する。
function createActionArgs(url: string, entries: Array<[string, string]>): ActionFunctionArgs {
  return {
    context: {},
    params: {},
    request: createFormRequest(url, entries),
  } as ActionFunctionArgs;
}

// createEditActionArgs は編集 action 用に params.id を含む引数を作成する。
function createEditActionArgs(questionId: string, entries: Array<[string, string]>): ActionFunctionArgs {
  return {
    context: {},
    params: { id: questionId },
    request: createFormRequest(`http://localhost/questions/${questionId}/edit`, entries),
  } as ActionFunctionArgs;
}

// toJson は Response の JSON ボディを型付きで返す。
async function toJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

describe("integration: 作問→一覧→編集", () => {
  beforeEach(() => {
    const questionStore = new Map<string, StoredQuestion>();
    let questionSequence = 1;
    let requestSequence = 1;

    requireAuthenticatedUserMock.mockResolvedValue({ userId: "user-1" });
    issueCsrfTokenMock.mockResolvedValue({ csrfToken: "csrf-test-token" });
    verifyCsrfTokenMock.mockResolvedValue({ requestId: "req-csrf-test" });
    createRequestIdMock.mockImplementation(() => `req-${requestSequence++}`);

    createQuestionMock.mockImplementation(async (params: { request: { draft: Omit<StoredQuestion, "id" | "updatedAt"> } }) => {
      const id = `q-${questionSequence++}`;
      const created: StoredQuestion = {
        id,
        prompt: params.request.draft.prompt,
        choices: [...params.request.draft.choices],
        correctOrdinal: params.request.draft.correctOrdinal,
        explanation: params.request.draft.explanation ?? "",
        updatedAt: "2026-02-08T00:00:00.000Z",
      };
      questionStore.set(id, created);

      return {
        requestId: "req-create",
        response: {
          question: toQuestionDetailResponse(created),
        },
      };
    });

    listMyQuestionsMock.mockImplementation(async () => ({
      requestId: "req-list",
      response: {
        questions: [...questionStore.values()].map(toQuestionSummaryResponse),
      },
    }));

    getMyQuestionMock.mockImplementation(async (params: { request: { questionId: string } }) => {
      const target = questionStore.get(params.request.questionId);
      return {
        requestId: "req-get",
        response: {
          question: target ? toQuestionDetailResponse(target) : undefined,
        },
      };
    });

    updateQuestionMock.mockImplementation(
      async (params: { request: { draft: Omit<StoredQuestion, "id" | "updatedAt">; questionId: string } }) => {
        const current = questionStore.get(params.request.questionId);
        if (!current) {
          return {
            requestId: "req-update",
            response: {
              question: undefined,
            },
          };
        }

        const updated: StoredQuestion = {
          ...current,
          prompt: params.request.draft.prompt,
          choices: [...params.request.draft.choices],
          correctOrdinal: params.request.draft.correctOrdinal,
          explanation: params.request.draft.explanation ?? "",
          updatedAt: "2026-02-08T00:10:00.000Z",
        };
        questionStore.set(current.id, updated);

        return {
          requestId: "req-update",
          response: {
            question: toQuestionDetailResponse(updated),
          },
        };
      },
    );

    listMyAttemptsMock.mockResolvedValue({
      requestId: "req-attempts",
      response: {
        attempts: [],
      },
    });

    getMyStatsMock.mockResolvedValue({
      requestId: "req-stats",
      response: {
        stats: {
          accuracy: 0,
          correctAttempts: "0",
          totalAttempts: "0",
        },
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("作成した問題が一覧に出て、編集後の内容が再取得できる", async () => {
    const createResponse = await createQuestionAction(
      createActionArgs("http://localhost/questions/new", [
        ["prompt", "日本の首都はどこですか？"],
        ["choices", "東京"],
        ["choices", "大阪"],
        ["choices", "名古屋"],
        ["choices", "札幌"],
        ["correctOrdinal", "0"],
        ["explanation", "首都機能が置かれている都市は東京です。"],
      ]),
    );
    expect(createResponse.status).toBe(200);
    expect(createQuestionMock).toHaveBeenCalledWith({
      callContext: { requestId: "req-csrf-test", userId: "user-1" },
      request: {
        draft: {
          prompt: "日本の首都はどこですか？",
          choices: ["東京", "大阪", "名古屋", "札幌"],
          correctOrdinal: 0,
          explanation: "首都機能が置かれている都市は東京です。",
        },
      },
    });

    const createBody = await toJson<{ ok: boolean; question: { id: string; prompt: string } }>(createResponse);
    expect(createBody.ok).toBe(true);
    expect(createBody.question.prompt).toBe("日本の首都はどこですか？");
    const createdQuestionId = createBody.question.id;

    const firstMeResponse = await meLoader(createLoaderArgs("http://localhost/me"));
    expect(firstMeResponse.status).toBe(200);
    const firstMeBody = await toJson<{ questions: Array<{ id: string; prompt: string; updatedAt: string }> }>(
      firstMeResponse,
    );
    expect(firstMeBody.questions).toHaveLength(1);
    expect(firstMeBody.questions[0]).toEqual(
      expect.objectContaining({
        id: createdQuestionId,
        prompt: "日本の首都はどこですか？",
      }),
    );
    expect(listMyQuestionsMock).toHaveBeenCalledWith({
      callContext: expect.objectContaining({
        requestId: expect.any(String),
        userId: "user-1",
      }),
      request: {
        pagination: { pageSize: 20 },
      },
    });

    const editLoadResponse = await editQuestionLoader(
      createLoaderArgs(`http://localhost/questions/${createdQuestionId}/edit`, { id: createdQuestionId }),
    );
    expect(editLoadResponse.status).toBe(200);
    const editLoadBody = await toJson<{ initialValues: { prompt: string; correctOrdinal: number } }>(
      editLoadResponse,
    );
    expect(editLoadBody.initialValues.prompt).toBe("日本の首都はどこですか？");
    expect(editLoadBody.initialValues.correctOrdinal).toBe(0);
    expect(getMyQuestionMock).toHaveBeenCalledWith({
      callContext: expect.objectContaining({
        requestId: expect.any(String),
        userId: "user-1",
      }),
      request: { questionId: createdQuestionId },
    });

    const editActionResponse = await editQuestionAction(
      createEditActionArgs(createdQuestionId, [
        ["prompt", "日本の首都はどこ？（更新後）"],
        ["choices", "東京"],
        ["choices", "大阪"],
        ["choices", "名古屋"],
        ["choices", "札幌"],
        ["correctOrdinal", "0"],
        ["explanation", "更新後の解説です。"],
      ]),
    );
    expect(editActionResponse.status).toBe(200);
    const editActionBody = await toJson<{ ok: boolean; question: { id: string; prompt: string } }>(
      editActionResponse,
    );
    expect(editActionBody.ok).toBe(true);
    expect(editActionBody.question).toEqual({
      id: createdQuestionId,
      prompt: "日本の首都はどこ？（更新後）",
    });
    expect(updateQuestionMock).toHaveBeenCalledWith({
      callContext: expect.objectContaining({
        requestId: expect.any(String),
        userId: "user-1",
      }),
      request: {
        questionId: createdQuestionId,
        draft: {
          prompt: "日本の首都はどこ？（更新後）",
          choices: ["東京", "大阪", "名古屋", "札幌"],
          correctOrdinal: 0,
          explanation: "更新後の解説です。",
        },
      },
    });

    const secondMeResponse = await meLoader(createLoaderArgs("http://localhost/me"));
    expect(secondMeResponse.status).toBe(200);
    const secondMeBody = await toJson<{ questions: Array<{ id: string; prompt: string; updatedAt: string }> }>(
      secondMeResponse,
    );
    expect(secondMeBody.questions).toEqual([
      expect.objectContaining({
        id: createdQuestionId,
        prompt: "日本の首都はどこ？（更新後）",
      }),
    ]);
  });
});
