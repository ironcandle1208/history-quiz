// 問題作成画面。
// zod + conform を使った入力検証と gRPC(CreateQuestion) 呼び出しを扱う。

import type { SubmissionResult } from "@conform-to/react";
import { getCollectionProps, getFormProps, getInputProps, getTextareaProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation } from "@remix-run/react";

import { createQuestion } from "../grpc/question.server";
import {
  QUESTION_CHOICES_COUNT,
  type CreateQuestionFormValue,
  createQuestionFormSchema,
  toQuestionConformFieldErrors,
} from "../schemas/question";
import { requireAuthenticatedUser } from "../services/auth.server";
import { CSRF_TOKEN_FIELD_NAME, issueCsrfToken, verifyCsrfToken } from "../services/csrf.server";
import { normalizeGrpcHttpError } from "../services/grpc-error.server";
import { assertRequestContentLengthWithinLimit } from "../services/request-size.server";

type LoaderData = {
  csrfToken: string;
  ok: true;
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
const QUESTION_CREATE_ACTION_MAX_BODY_BYTES = 32 * 1024;

// loader は未認証アクセスをログインへリダイレクトさせる。
export async function loader({ request }: LoaderFunctionArgs) {
  await requireAuthenticatedUser(request);
  const { csrfToken, setCookie } = await issueCsrfToken(request);
  return json<LoaderData>(
    { csrfToken, ok: true },
    {
      headers: setCookie ? { "Set-Cookie": setCookie } : undefined,
    },
  );
}

// action は問題作成フォームの入力検証と保存処理を実行する。
export async function action({ request }: ActionFunctionArgs) {
  const user = await requireAuthenticatedUser(request);
  const { requestId } = assertRequestContentLengthWithinLimit({
    maxBytes: QUESTION_CREATE_ACTION_MAX_BODY_BYTES,
    request,
  });
  const formData = await request.formData();
  const { requestId: verifiedRequestId } = await verifyCsrfToken({ formData, request, requestId });
  const submission = parseWithZod(formData, { schema: createQuestionFormSchema });

  if (submission.status !== "success") {
    return json<ActionData>(
      {
        ok: false,
        message: "入力内容を確認してください。",
        requestId: verifiedRequestId,
        submissionResult: submission.reply(),
      },
      { status: 400, headers: { "x-request-id": verifiedRequestId } },
    );
  }

  try {
    const result = await createQuestion({
      callContext: { requestId: verifiedRequestId, userId: user.userId },
      request: {
        draft: {
          prompt: submission.value.prompt,
          choices: submission.value.choices,
          correctOrdinal: submission.value.correctOrdinal,
          explanation: submission.value.explanation,
        },
      },
    });
    const createdQuestion = result.response.question;
    if (!createdQuestion || createdQuestion.id.length === 0) {
      throw new Error("作成結果の問題IDが取得できませんでした。");
    }

    return json<ActionData>(
      {
        ok: true,
        question: {
          id: createdQuestion.id,
          prompt: createdQuestion.prompt,
        },
        requestId: result.requestId,
        submissionResult: submission.reply({ resetForm: true }),
      },
      {
        headers: {
          "x-request-id": result.requestId,
        },
      },
    );
  } catch (error) {
    const normalized = normalizeGrpcHttpError({
      error,
      fallbackMessage: "問題の保存に失敗しました。時間をおいて再試行してください。",
      requestId: verifiedRequestId,
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

export default function QuestionsNewRoute() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting" && navigation.formMethod === "post";

  const [form, fields] = useForm<CreateQuestionFormValue>({
    constraint: getZodConstraint(createQuestionFormSchema),
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
      <h1>問題作成</h1>
      <p className="muted">
        問題文・選択肢4件・正解を入力して保存します（作成者本人のデータとして保存されます）。
      </p>

      <Form method="post" {...getFormProps(form)}>
        <input type="hidden" name={CSRF_TOKEN_FIELD_NAME} value={data.csrfToken} />
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
          {isSubmitting ? "保存中..." : "保存する"}
        </button>
      </Form>

      {form.errors?.[0] ? <p style={{ color: "#ffb4b4" }}>{form.errors[0]}</p> : null}

      {actionData?.ok === false && actionData.message && !form.errors?.[0] ? (
        <p style={{ color: "#ffb4b4" }}>{actionData.message}</p>
      ) : null}

      {actionData?.ok === true && actionData.question ? (
        <p style={{ color: "#9ce69c" }}>
          保存しました：<code>{actionData.question.prompt}</code>（ID: <code>{actionData.question.id}</code>）
        </p>
      ) : null}

      {actionData?.requestId ? (
        <p className="muted">
          requestId: <code>{actionData.requestId}</code>
        </p>
      ) : null}
    </section>
  );
}
