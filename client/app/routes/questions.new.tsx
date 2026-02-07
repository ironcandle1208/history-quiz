// 問題作成画面。
// zod + conform による入力検証を前提に、サーバー側で最終バリデーションを行う。

import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useActionData } from "@remix-run/react";

// loader は現時点では不要だが、Remix のルーティング骨格として用意しておく。
export async function loader(_args: LoaderFunctionArgs) {
  return json({ ok: true });
}

type ActionData =
  | { ok: true; prompt: string }
  | { ok: false; message: string; fieldErrors?: { prompt?: string } };

// action は「問題作成」のフォーム送信を受ける。
// NOTE: 後続タスクで zod+conform + gRPC(CreateQuestion) に置き換える。
export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const prompt = formData.get("prompt");

  if (typeof prompt !== "string" || prompt.trim().length === 0) {
    return json<ActionData>(
      { ok: false, message: "入力内容を確認してください。", fieldErrors: { prompt: "問題文は必須です。" } },
      { status: 400 },
    );
  }

  return json<ActionData>({ ok: true, prompt: prompt.trim() });
}

export default function QuestionsNewRoute() {
  const actionData = useActionData<typeof action>();

  return (
    <section className="card">
      <h1>問題作成</h1>
      <p className="muted">この画面は後続タスクで入力検証と gRPC 呼び出しを追加します。</p>

      <Form method="post">
        <label style={{ display: "block" }}>
          問題文
          <input
            type="text"
            name="prompt"
            aria-invalid={actionData?.ok === false && actionData.fieldErrors?.prompt ? true : undefined}
            aria-errormessage={actionData?.ok === false && actionData.fieldErrors?.prompt ? "prompt-error" : undefined}
            style={{ display: "block", width: "100%", marginTop: 6 }}
          />
        </label>

        {actionData?.ok === false && actionData.fieldErrors?.prompt ? (
          <p id="prompt-error" style={{ color: "#ffb4b4" }}>
            {actionData.fieldErrors.prompt}
          </p>
        ) : null}

        <button type="submit" style={{ marginTop: 12 }}>
          保存（仮）
        </button>
      </Form>

      {actionData?.ok === true ? (
        <p>
          保存しました（仮）：<code>{actionData.prompt}</code>
        </p>
      ) : null}
    </section>
  );
}
