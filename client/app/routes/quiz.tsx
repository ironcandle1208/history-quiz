// クイズ画面（取得→回答→判定→次へ）を提供するルート。
// NOTE: 実際の gRPC 呼び出しは server-only のクライアントを経由する（ブラウザから直接 gRPC は呼ばない）。

import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";

type LoaderData = {
  // NOTE: ここは後続タスク（GetQuestion）で置き換える前提のダミーデータ。
  question: { id: string; prompt: string; choices: { id: string; label: string }[] };
};

// loader は SSR 時に「表示に必要なデータ」を用意する。
export async function loader(_args: LoaderFunctionArgs) {
  const data: LoaderData = {
    question: {
      id: "dummy-question",
      prompt: "（未実装）このクイズ画面は後続タスクで gRPC と接続します。",
      choices: [
        { id: "a", label: "選択肢A" },
        { id: "b", label: "選択肢B" },
        { id: "c", label: "選択肢C" },
        { id: "d", label: "選択肢D" },
      ],
    },
  };

  return json(data);
}

type ActionData =
  | { ok: true; selectedChoiceId: string }
  | { ok: false; message: string; selectedChoiceId?: string };

// action はフォーム送信（POST）を受けて処理する。
// NOTE: 現時点では gRPC 呼び出しをせず、ルーティングの骨格のみ確認できるようにする。
export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const selectedChoiceId = formData.get("choiceId");

  if (typeof selectedChoiceId !== "string" || selectedChoiceId.length === 0) {
    return json<ActionData>({ ok: false, message: "選択肢を選んでください。" }, { status: 400 });
  }

  return json<ActionData>({ ok: true, selectedChoiceId });
}

export default function QuizRoute() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <section className="card">
      <h1>クイズ</h1>
      <p className="muted">{data.question.prompt}</p>

      <Form method="post">
        <fieldset>
          <legend className="muted">回答</legend>
          {data.question.choices.map((choice) => (
            <label key={choice.id} style={{ display: "block", marginTop: 8 }}>
              <input type="radio" name="choiceId" value={choice.id} /> {choice.label}
            </label>
          ))}
        </fieldset>

        <button type="submit" style={{ marginTop: 12 }}>
          回答する
        </button>
      </Form>

      {actionData?.ok === false ? <p style={{ color: "#ffb4b4" }}>{actionData.message}</p> : null}
      {actionData?.ok === true ? (
        <p>
          送信しました（仮）：<code>{actionData.selectedChoiceId}</code>
        </p>
      ) : null}
    </section>
  );
}
