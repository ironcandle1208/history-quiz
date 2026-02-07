// 問題編集画面。
// NOTE: 他人の問題を編集しようとした場合は、バックエンドの所有者チェックで拒否される想定。

import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";

type LoaderData = { questionId: string };

// loader は編集対象（id）を受け取り、表示に必要なデータを返す。
// NOTE: 後続タスクで GetMyQuestion を呼び出し、初期値を埋める。
export async function loader({ params }: LoaderFunctionArgs) {
  const questionId = params.id;
  if (!questionId) {
    return json({ message: "id が指定されていません。" }, { status: 400 });
  }

  const data: LoaderData = { questionId };
  return json(data);
}

type ActionData = { ok: true; questionId: string } | { ok: false; message: string };

// action は編集フォーム送信を受ける（暫定）。
export async function action({ params }: ActionFunctionArgs) {
  const questionId = params.id;
  if (!questionId) {
    return json<ActionData>({ ok: false, message: "id が指定されていません。" }, { status: 400 });
  }

  return json<ActionData>({ ok: true, questionId });
}

export default function QuestionsEditRoute() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <section className="card">
      <h1>問題編集</h1>
      <p className="muted">
        編集対象: <code>{data.questionId}</code>
      </p>

      <Form method="post">
        <button type="submit">保存（仮）</button>
      </Form>

      {actionData?.ok === true ? <p>保存しました（仮）</p> : null}
    </section>
  );
}
