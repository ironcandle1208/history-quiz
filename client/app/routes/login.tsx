// ログイン開始（OIDC へリダイレクト）とログアウトを扱うルート。

import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";

import { resolvePostLoginRedirect, sanitizeRedirectTo } from "../services/auth.server";
import { beginOidcAuthorization, OidcFlowError } from "../services/oidc.server";
import { createPendingOidcAuthCookie, destroyUserSessionCookie, getUser } from "../services/session.server";

type LoaderData =
  | { isLoggedIn: true; message: string; userId: string }
  | { isLoggedIn: false; message: string };

// loader は未ログイン時に OIDC へリダイレクトし、ログイン済みなら管理画面を返す。
export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUser(request);
  const redirectTo = resolvePostLoginRedirect(request, "/me");
  if (user) {
    const requestedRedirect = sanitizeRedirectTo(new URL(request.url).searchParams.get("redirectTo"), "");
    if (requestedRedirect.length > 0) {
      return redirect(requestedRedirect);
    }

    return json<LoaderData>({
      isLoggedIn: true,
      message: "すでにログイン済みです。必要ならログアウトできます。",
      userId: user.userId,
    });
  }

  try {
    const { authorizationUrl, pendingAuth } = await beginOidcAuthorization({ redirectTo, request });
    const setCookie = await createPendingOidcAuthCookie({ pendingAuth, request });
    return redirect(authorizationUrl, {
      headers: { "Set-Cookie": setCookie },
    });
  } catch (error) {
    if (error instanceof OidcFlowError) {
      return json<LoaderData>(
        {
          isLoggedIn: false,
          message: error.message,
        },
        { status: error.status },
      );
    }

    return json<LoaderData>(
      {
        isLoggedIn: false,
        message: "ログインを開始できませんでした。設定を確認してから再試行してください。",
      },
      { status: 500 },
    );
  }
}

// action はログアウト操作を受け取り、セッションを破棄してトップへ戻す。
export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");
  if (intent !== "logout") {
    return json({ message: "不正なリクエストです。" }, { status: 400 });
  }

  const setCookie = await destroyUserSessionCookie(request);
  return redirect("/", {
    headers: { "Set-Cookie": setCookie },
  });
}

export default function LoginRoute() {
  const data = useLoaderData<typeof loader>();

  return (
    <section className="card">
      <h1>ログイン</h1>
      <p className="muted">{data.message}</p>

      {data.isLoggedIn ? (
        <>
          <p>
            ログイン中ユーザー: <code>{data.userId}</code>
          </p>
          <Form method="post">
            <input type="hidden" name="intent" value="logout" />
            <button type="submit">ログアウト</button>
          </Form>
        </>
      ) : (
        <p>
          <Link to="/">トップへ戻る</Link>
        </p>
      )}
    </section>
  );
}
