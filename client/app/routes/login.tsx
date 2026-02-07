// ログイン開始（OIDC へリダイレクト）を行うルート。
// NOTE: Authentik 連携の詳細は後続タスクで実装する。

import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";

type LoaderData = {
  // NOTE: 後続タスクで Authentik のログインURLへリダイレクトする。
  message: string;
};

// loader はログイン開始の準備をする（暫定）。
export async function loader(_args: LoaderFunctionArgs) {
  const data: LoaderData = { message: "（未実装）後続タスクで OIDC リダイレクトを実装します。" };
  return json(data);
}

export default function LoginRoute() {
  const data = useLoaderData<typeof loader>();

  return (
    <section className="card">
      <h1>ログイン</h1>
      <p className="muted">{data.message}</p>
      <p>
        現時点では <Link to="/">トップへ戻る</Link> のみ利用できます。
      </p>
    </section>
  );
}
