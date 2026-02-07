// マイページ（履歴/正答率/自作問題一覧）。

import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

import { requireAuthenticatedUser } from "../services/auth.server";

type LoaderData = {
  // NOTE: 後続タスクで gRPC（ListMyAttempts/GetMyStats/ListMyQuestions）に差し替える。
  message: string;
  userId: string;
};

// loader はマイページの表示に必要なデータを用意する（暫定）。
export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireAuthenticatedUser(request);
  const data: LoaderData = {
    message: "（未実装）履歴/統計は後続タスクで追加します。",
    userId: user.userId,
  };
  return json(data);
}

export default function MeRoute() {
  const data = useLoaderData<typeof loader>();

  return (
    <section className="card">
      <h1>マイページ</h1>
      <p className="muted">{data.message}</p>
      <p>
        ログイン中ユーザー: <code>{data.userId}</code>
      </p>
    </section>
  );
}
