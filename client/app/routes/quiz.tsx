// クイズ画面（取得→回答→判定→次へ）を提供するルート。
// 実際の通信は server-only の gRPC クライアント経由で行う。

import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { parseWithZod } from "@conform-to/zod";
import {
  Form,
  Link,
  isRouteErrorResponse,
  useActionData,
  useLoaderData,
  useNavigation,
  useRouteError,
} from "@remix-run/react";

import type { QuizQuestion } from "../grpc/quiz.server";
import { getQuestion, submitAnswer } from "../grpc/quiz.server";
import { quizAnswerFormSchema, resolveQuizChoiceFieldError } from "../schemas/quiz";
import { normalizeGrpcHttpError, throwGrpcErrorResponse } from "../services/grpc-error.server";
import { getUser } from "../services/session.server";

type LoaderData = {
  question: QuizQuestion;
  requestId: string;
};

type ActionData =
  | {
      ok: true;
      requestId: string;
      result: {
        attemptId: string;
        correctChoiceId: string;
        isCorrect: boolean;
        questionId: string;
        selectedChoiceId: string;
      };
    }
  | {
      ok: false;
      message: string;
      requestId?: string;
      selectedChoiceId?: string;
      fieldErrors?: {
        choiceId?: string;
      };
    };

// toOptionalTrimmedString は FormData / query の値を空文字除去付きで取り出す。
function toOptionalTrimmedString(value: FormDataEntryValue | string | null): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

// loader は SSR 時の出題データを取得する。
export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUser(request);
  const url = new URL(request.url);
  const previousQuestionId = toOptionalTrimmedString(url.searchParams.get("previousQuestionId"));

  try {
    const result = await getQuestion({
      callContext: { userId: user?.userId },
      request: { previousQuestionId },
    });
    const question = result.response.question;
    if (!question || question.id.length === 0) {
      throw new Error("問題データの取得に失敗しました。");
    }

    return json<LoaderData>(
      {
        question,
        requestId: result.requestId,
      },
      {
        headers: { "x-request-id": result.requestId },
      },
    );
  } catch (error) {
    throwGrpcErrorResponse({
      error,
      fallbackMessage: "問題の取得に失敗しました。時間をおいて再試行してください。",
    });
  }
}

// action は回答送信を受けて判定結果を返す。
export async function action({ request }: ActionFunctionArgs) {
  const user = await getUser(request);
  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema: quizAnswerFormSchema });
  if (submission.status !== "success") {
    const selectedChoiceId = toOptionalTrimmedString(formData.get("choiceId"));
    const choiceIdError = submission.error?.choiceId?.[0];
    const questionIdError = submission.error?.questionId?.[0];
    return json<ActionData>(
      {
        ok: false,
        message: questionIdError ?? "入力内容を確認してください。",
        selectedChoiceId,
        fieldErrors: {
          choiceId: choiceIdError,
        },
      },
      { status: 400 },
    );
  }
  const questionId = submission.value.questionId;
  const selectedChoiceId = submission.value.choiceId;

  try {
    const result = await submitAnswer({
      callContext: { userId: user?.userId },
      request: {
        questionId,
        selectedChoiceId,
      },
    });

    return json<ActionData>(
      {
        ok: true,
        requestId: result.requestId,
        result: {
          attemptId: result.response.attemptId,
          correctChoiceId: result.response.correctChoiceId,
          isCorrect: result.response.isCorrect,
          questionId,
          selectedChoiceId,
        },
      },
      {
        headers: { "x-request-id": result.requestId },
      },
    );
  } catch (error) {
    const normalized = normalizeGrpcHttpError({
      error,
      fallbackMessage: "回答の送信に失敗しました。時間をおいて再試行してください。",
    });
    return json<ActionData>(
      {
        ok: false,
        message: normalized.payload.error.message,
        requestId: normalized.requestId,
        selectedChoiceId,
        fieldErrors: {
          choiceId: resolveQuizChoiceFieldError(normalized.fieldErrors),
        },
      },
      {
        status: normalized.httpStatus,
        headers: normalized.requestId ? { "x-request-id": normalized.requestId } : undefined,
      },
    );
  }
}

export default function QuizRoute() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  const isSubmitting = navigation.state === "submitting" && navigation.formMethod === "post";
  const answered = actionData?.ok === true;
  const selectedChoiceId =
    actionData?.ok === true ? actionData.result.selectedChoiceId : actionData?.selectedChoiceId;
  const correctChoiceId = actionData?.ok === true ? actionData.result.correctChoiceId : undefined;

  const correctChoiceLabel = correctChoiceId
    ? data.question.choices.find((choice) => choice.id === correctChoiceId)?.label
    : undefined;

  return (
    <section className="card">
      <h1>クイズ</h1>
      <p className="muted">{data.question.prompt}</p>

      <Form method="post">
        <input type="hidden" name="questionId" value={data.question.id} />
        <fieldset disabled={isSubmitting || answered}>
          <legend className="muted">回答</legend>
          {data.question.choices.map((choice) => {
            const isCorrectChoice = answered && choice.id === correctChoiceId;
            const isSelectedChoice = choice.id === selectedChoiceId;
            return (
              <label key={choice.id} style={{ display: "block", marginTop: 8 }}>
                <input
                  defaultChecked={isSelectedChoice}
                  name="choiceId"
                  type="radio"
                  value={choice.id}
                  aria-invalid={
                    actionData?.ok === false && actionData.fieldErrors?.choiceId ? true : undefined
                  }
                  aria-errormessage={
                    actionData?.ok === false && actionData.fieldErrors?.choiceId
                      ? "quiz-choice-error"
                      : undefined
                  }
                />{" "}
                {choice.label}
                {isCorrectChoice ? "（正解）" : null}
                {answered && !actionData.result.isCorrect && isSelectedChoice ? "（あなたの回答）" : null}
              </label>
            );
          })}
        </fieldset>

        {actionData?.ok === false && actionData.fieldErrors?.choiceId ? (
          <p id="quiz-choice-error" style={{ color: "#ffb4b4" }}>
            {actionData.fieldErrors.choiceId}
          </p>
        ) : null}

        <button type="submit" style={{ marginTop: 12 }} disabled={isSubmitting || answered}>
          {isSubmitting ? "送信中..." : "回答する"}
        </button>
      </Form>

      {actionData?.ok === false ? <p style={{ color: "#ffb4b4" }}>{actionData.message}</p> : null}

      {actionData?.ok === true ? (
        <>
          <p style={{ color: actionData.result.isCorrect ? "#9ce69c" : "#ffd3a1" }}>
            {actionData.result.isCorrect ? "正解です。" : "不正解です。"}
          </p>
          {!actionData.result.isCorrect && correctChoiceLabel ? (
            <p>
              正解: <strong>{correctChoiceLabel}</strong>
            </p>
          ) : null}
          {data.question.explanation.length > 0 ? (
            <p className="muted">
              解説: <span>{data.question.explanation}</span>
            </p>
          ) : null}
          <Form method="get">
            <input type="hidden" name="previousQuestionId" value={data.question.id} />
            <button type="submit" style={{ marginTop: 8 }}>
              次の問題へ
            </button>
          </Form>
        </>
      ) : null}

      <p className="muted" style={{ marginTop: 16 }}>
        requestId: <code>{actionData?.requestId ?? data.requestId}</code>
      </p>
    </section>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();

  let message = "クイズ画面の表示中にエラーが発生しました。";
  let requestId: string | undefined;

  if (isRouteErrorResponse(error)) {
    const data = error.data as { error?: { message?: string }; requestId?: string } | undefined;
    if (typeof data?.error?.message === "string" && data.error.message.length > 0) {
      message = data.error.message;
    }
    if (typeof data?.requestId === "string" && data.requestId.length > 0) {
      requestId = data.requestId;
    }
  }

  return (
    <section className="card">
      <h1>クイズ</h1>
      <p style={{ color: "#ffb4b4" }}>{message}</p>
      {requestId ? (
        <p className="muted">
          requestId: <code>{requestId}</code>
        </p>
      ) : null}
      <p>
        <Link to="/quiz">再試行する</Link>
      </p>
    </section>
  );
}
