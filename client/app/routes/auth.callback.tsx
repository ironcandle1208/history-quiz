// OIDC コールバック（code/state）を処理してログインセッションを確立するルート。

import type { LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";

import { buildLoginUrl, sanitizeRedirectTo } from "../services/auth.server";
import { completeOidcAuthorization, OidcFlowError } from "../services/oidc.server";
import {
  clearPendingOidcAuthCookie,
  createUserSessionCookie,
  getPendingOidcAuth,
} from "../services/session.server";

type LoaderData = {
  message: string;
  retryUrl: string;
};

// createErrorResponse は失敗時レスポンスと OIDC 一時セッション破棄をまとめる。
async function createErrorResponse(params: {
  message: string;
  request: Request;
  retryRedirectTo: string;
  status: number;
}) {
  const setCookie = await clearPendingOidcAuthCookie(params.request);
  return json<LoaderData>(
    {
      message: params.message,
      retryUrl: buildLoginUrl(params.retryRedirectTo),
    },
    {
      headers: { "Set-Cookie": setCookie },
      status: params.status,
    },
  );
}

// loader は OIDC callback の検証とセッション保存を行い、成功時に元画面へ戻す。
export async function loader({ request }: LoaderFunctionArgs) {
  const callbackUrl = new URL(request.url);
  const pendingAuth = await getPendingOidcAuth(request);
  const retryRedirectTo = sanitizeRedirectTo(pendingAuth?.redirectTo, "/me");

  const providerError = callbackUrl.searchParams.get("error");
  if (providerError) {
    return createErrorResponse({
      message: "ログインがキャンセルされたか、認証サーバーでエラーが発生しました。再度お試しください。",
      request,
      retryRedirectTo,
      status: 401,
    });
  }

  const code = callbackUrl.searchParams.get("code");
  const state = callbackUrl.searchParams.get("state");
  if (!code || !state) {
    return createErrorResponse({
      message: "認証レスポンスが不正です。再度ログインしてください。",
      request,
      retryRedirectTo,
      status: 400,
    });
  }

  if (!pendingAuth) {
    return createErrorResponse({
      message: "ログインセッションが期限切れです。再度ログインしてください。",
      request,
      retryRedirectTo,
      status: 401,
    });
  }

  if (state !== pendingAuth.state) {
    return createErrorResponse({
      message: "state の検証に失敗しました。CSRF 対策のため処理を中断しました。",
      request,
      retryRedirectTo,
      status: 401,
    });
  }

  try {
    const result = await completeOidcAuthorization({
      code,
      pendingAuth,
      request,
    });
    const setCookie = await createUserSessionCookie({
      request,
      userId: result.subject,
    });
    return redirect(retryRedirectTo, {
      headers: { "Set-Cookie": setCookie },
    });
  } catch (error) {
    if (error instanceof OidcFlowError) {
      return createErrorResponse({
        message: error.message,
        request,
        retryRedirectTo,
        status: error.status,
      });
    }

    return createErrorResponse({
      message: "ログイン処理中に予期しないエラーが発生しました。時間をおいて再試行してください。",
      request,
      retryRedirectTo,
      status: 500,
    });
  }
}

export default function AuthCallbackRoute() {
  const data = useLoaderData<typeof loader>();

  return (
    <section className="card">
      <h1>ログインエラー</h1>
      <p className="muted">{data.message}</p>
      <p>
        <Link to={data.retryUrl}>ログインをやり直す</Link>
      </p>
    </section>
  );
}
