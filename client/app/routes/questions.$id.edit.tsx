// 問題編集画面（取得→編集→保存）。
// zod + conform を使って入力検証し、gRPC(GetMyQuestion/UpdateQuestion) を呼び出す。

import type { SubmissionResult } from "@conform-to/react";
import { getCollectionProps, getFormProps, getInputProps, getTextareaProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  Form,
  Link,
  isRouteErrorResponse,
  useActionData,
  useLoaderData,
  useNavigation,
  useRouteError,
} from "@remix-run/react";

import { createRequestId } from "../grpc/client.server";
import type { QuestionDetail } from "../grpc/question.server";
import { getMyQuestion, updateQuestion } from "../grpc/question.server";
import {
  QUESTION_CHOICES_COUNT,
  type CreateQuestionFormValue,
  createQuestionFormSchema,
  toQuestionConformFieldErrors,
} from "../schemas/question";
import { requireAuthenticatedUser } from "../services/auth.server";
import { normalizeGrpcHttpError, throwGrpcErrorResponse } from "../services/grpc-error.server";

type LoaderData = {
  initialValues: CreateQuestionFormValue;
  questionId: string;
  requestId: string;
  userId: string;
};

type ActionData = {
  ok: boolean;
  message?: string;
  question?: {
    id: string;
    prompt: string;
  };
  requestId?: string;
  submissionResult?: SubmissionResult<string[]>;
};

// resolveRequiredQuestionId は URL パラメータの問題IDを検証し、空値を拒否する。
function resolveRequiredQuestionId(id: string | undefined): string {
  const normalized = id?.trim() ?? "";
  if (normalized.length === 0) {
    throw json({ message: "id が指定されていません。" }, { status: 400 });
  }
  return normalized;
}

// toSortedChoices は choice の順序が不定でも ordinal 昇順へ揃えて返す。
function toSortedChoices(question: QuestionDetail): QuestionDetail["choices"] {
  return [...question.choices].sort((left, right) => left.ordinal - right.ordinal);
}

// toInitialFormValues は取得した問題データを conform の初期値へ変換する。
function toInitialFormValues(question: QuestionDetail): CreateQuestionFormValue {
  const sortedChoices = toSortedChoices(question);
  if (sortedChoices.length !== QUESTION_CHOICES_COUNT) {
    throw new Error("選択肢の件数が不正です。");
  }

  const correctOrdinal = sortedChoices.findIndex((choice) => choice.id === question.correctChoiceId);
  if (correctOrdinal < 0) {
    throw new Error("正解選択肢の解決に失敗しました。");
  }

  return {
    prompt: question.prompt,
    choices: sortedChoices.map((choice) => choice.label),
    correctOrdinal,
    explanation: question.explanation ?? "",
  };
}

// loader は編集対象を取得し、フォーム初期値を返す。
export async function loader({ params, request }: LoaderFunctionArgs) {
  const user = await requireAuthenticatedUser(request);
  const questionId = resolveRequiredQuestionId(params.id);
  const requestId = createRequestId();

  try {
    const result = await getMyQuestion({
      callContext: { requestId, userId: user.userId },
      request: { questionId },
    });
    const question = result.response.question;
    if (!question || question.id.length === 0) {
      throw new Error("編集対象の問題データが見つかりません。");
    }

    return json<LoaderData>(
      {
        initialValues: toInitialFormValues(question),
        questionId: question.id,
        requestId,
        userId: user.userId,
      },
      {
        headers: { "x-request-id": requestId },
      },
    );
  } catch (error) {
    throwGrpcErrorResponse({
      error,
      fallbackMessage: "問題の取得に失敗しました。時間をおいて再試行してください。",
      requestId,
    });
  }
}

// action は編集フォーム送信を受け、入力検証と更新保存を実行する。
export async function action({ params, request }: ActionFunctionArgs) {
  const user = await requireAuthenticatedUser(request);
  const questionId = params.id?.trim();
  if (!questionId) {
    return json<ActionData>({ ok: false, message: "id が指定されていません。" }, { status: 400 });
  }

  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema: createQuestionFormSchema });
  if (submission.status !== "success") {
    return json<ActionData>(
      {
        ok: false,
        message: "入力内容を確認してください。",
        submissionResult: submission.reply(),
      },
      { status: 400 },
    );
  }

  const requestId = createRequestId();

  try {
    const result = await updateQuestion({
      callContext: { requestId, userId: user.userId },
      request: {
        questionId,
        draft: {
          prompt: submission.value.prompt,
          choices: submission.value.choices,
          correctOrdinal: submission.value.correctOrdinal,
          explanation: submission.value.explanation,
        },
      },
    });
    const updatedQuestion = result.response.question;
    if (!updatedQuestion || updatedQuestion.id.length === 0) {
      throw new Error("更新結果の問題IDが取得できませんでした。");
    }

    return json<ActionData>(
      {
        ok: true,
        question: {
          id: updatedQuestion.id,
          prompt: updatedQuestion.prompt,
        },
        requestId,
        submissionResult: submission.reply(),
      },
      {
        headers: {
          "x-request-id": requestId,
        },
      },
    );
  } catch (error) {
    const normalized = normalizeGrpcHttpError({
      error,
      fallbackMessage: "問題の更新に失敗しました。時間をおいて再試行してください。",
      requestId,
    });
    const convertedFieldErrors = toQuestionConformFieldErrors(normalized.fieldErrors);

    return json<ActionData>(
      {
        ok: false,
        message: normalized.payload.error.message,
        requestId: normalized.requestId,
        submissionResult: submission.reply({
          formErrors: [normalized.payload.error.message],
          fieldErrors: convertedFieldErrors,
        }),
      },
      {
        status: normalized.httpStatus,
        headers: normalized.requestId ? { "x-request-id": normalized.requestId } : undefined,
      },
    );
  }
}

// QuestionsEditRoute は問題編集フォームを表示し、送信結果を反映する。
export default function QuestionsEditRoute() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting" && navigation.formMethod === "post";

  const [form, fields] = useForm<CreateQuestionFormValue>({
    constraint: getZodConstraint(createQuestionFormSchema),
    defaultValue: data.initialValues,
    lastResult: actionData?.submissionResult,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: createQuestionFormSchema });
    },
    shouldRevalidate: "onInput",
    shouldValidate: "onBlur",
  });

  const choiceFields = fields.choices.getFieldList();
  const correctOrdinalOptions = getCollectionProps(fields.correctOrdinal, {
    type: "radio",
    options: choiceFields.map((_, index) => String(index)),
  });

  return (
    <section className="card">
      <h1>問題編集</h1>
      <p className="muted">
        編集対象: <code>{data.questionId}</code>
      </p>
      <p className="muted">
        ログイン中ユーザー: <code>{data.userId}</code>
      </p>

      <Form method="post" {...getFormProps(form)}>
        <label style={{ display: "block" }}>
          問題文
          <input {...getInputProps(fields.prompt, { type: "text" })} style={{ display: "block", marginTop: 6, width: "100%" }} />
        </label>
        {fields.prompt.errors?.[0] ? (
          <p id={fields.prompt.errorId} style={{ color: "#ffb4b4" }}>
            {fields.prompt.errors[0]}
          </p>
        ) : null}

        <fieldset style={{ border: "none", margin: "12px 0 0", padding: 0 }}>
          <legend className="muted">選択肢（{QUESTION_CHOICES_COUNT}件）</legend>
          {fields.choices.errors?.[0] ? (
            <p id={fields.choices.errorId} style={{ color: "#ffb4b4" }}>
              {fields.choices.errors[0]}
            </p>
          ) : null}
          {choiceFields.map((choiceField, index) => (
            <div key={choiceField.key} style={{ marginTop: 8 }}>
              <label style={{ display: "block" }}>
                選択肢 {index + 1}
                <input
                  {...getInputProps(choiceField, { type: "text" })}
                  style={{ display: "block", marginTop: 6, width: "100%" }}
                />
              </label>
              {choiceField.errors?.[0] ? (
                <p id={choiceField.errorId} style={{ color: "#ffb4b4" }}>
                  {choiceField.errors[0]}
                </p>
              ) : null}
            </div>
          ))}
        </fieldset>

        <fieldset style={{ border: "none", margin: "12px 0 0", padding: 0 }}>
          <legend className="muted">正解</legend>
          {correctOrdinalOptions.map((option, index) => (
            <label key={option.key} style={{ display: "block", marginTop: 4 }}>
              <input {...option} /> 選択肢 {index + 1}
            </label>
          ))}
        </fieldset>
        {fields.correctOrdinal.errors?.[0] ? (
          <p id={fields.correctOrdinal.errorId} style={{ color: "#ffb4b4" }}>
            {fields.correctOrdinal.errors[0]}
          </p>
        ) : null}

        <label style={{ display: "block", marginTop: 12 }}>
          解説（任意）
          <textarea {...getTextareaProps(fields.explanation)} rows={4} style={{ display: "block", marginTop: 6, width: "100%" }} />
        </label>
        {fields.explanation.errors?.[0] ? (
          <p id={fields.explanation.errorId} style={{ color: "#ffb4b4" }}>
            {fields.explanation.errors[0]}
          </p>
        ) : null}

        <button type="submit" style={{ marginTop: 12 }} disabled={isSubmitting}>
          {isSubmitting ? "更新中..." : "更新する"}
        </button>
      </Form>

      {form.errors?.[0] ? <p style={{ color: "#ffb4b4" }}>{form.errors[0]}</p> : null}
      {actionData?.ok === false && actionData.message && !form.errors?.[0] ? (
        <p style={{ color: "#ffb4b4" }}>{actionData.message}</p>
      ) : null}
      {actionData?.ok === true && actionData.question ? (
        <p style={{ color: "#9ce69c" }}>
          更新しました：<code>{actionData.question.prompt}</code>（ID: <code>{actionData.question.id}</code>）
        </p>
      ) : null}

      <p className="muted">
        requestId: <code>{actionData?.requestId ?? data.requestId}</code>
      </p>
    </section>
  );
}

// ErrorBoundary は loader/action 失敗時に共通エラー表示を行う。
export function ErrorBoundary() {
  const error = useRouteError();

  let message = "問題編集画面の表示中にエラーが発生しました。";
  let requestId: string | undefined;

  if (isRouteErrorResponse(error)) {
    const data = error.data as { error?: { message?: string }; message?: string; requestId?: string } | undefined;
    if (typeof data?.error?.message === "string" && data.error.message.length > 0) {
      message = data.error.message;
    } else if (typeof data?.message === "string" && data.message.length > 0) {
      message = data.message;
    }
    if (typeof data?.requestId === "string" && data.requestId.length > 0) {
      requestId = data.requestId;
    }
  }

  return (
    <section className="card">
      <h1>問題編集</h1>
      <p style={{ color: "#ffb4b4" }}>{message}</p>
      {requestId ? (
        <p className="muted">
          requestId: <code>{requestId}</code>
        </p>
      ) : null}
      <p>
        <Link to="/me">マイページへ戻る</Link>
      </p>
    </section>
  );
}
