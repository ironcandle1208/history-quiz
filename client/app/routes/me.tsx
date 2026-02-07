// マイページ（履歴/正答率/自作問題一覧）。

import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";

type LoaderData = {
  // NOTE: 後続タスクで gRPC（ListMyAttempts/GetMyStats/ListMyQuestions）に差し替える。
  message: string;
};

// loader はマイページの表示に必要なデータを用意する（暫定）。
export async function loader(_args: LoaderFunctionArgs) {
  const data: LoaderData = { message: "（未実装）履歴/統計は後続タスクで追加します。" };
  return json(data);
}

export default function MeRoute() {
  const data = useLoaderData<typeof loader>();

  return (
    <section className="card">
      <h1>マイページ</h1>
      <p className="muted">{data.message}</p>
      <p>
        まずは <Link to="/login">ログイン</Link> が必要です（認証は後続タスクで実装）。
      </p>
    </section>
  );
}
