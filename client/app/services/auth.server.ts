// 認証（OIDC）関連のサーバー専用ロジックをまとめる。
// task18 では「未認証時にログイン画面へ誘導する」責務を先に実装する。

import { redirect } from "@remix-run/node";

import type { SessionUser } from "./session.server";
import { getUser } from "./session.server";

const LOGIN_PATH = "/login";
const DEFAULT_AFTER_LOGIN_PATH = "/me";

// sanitizeRedirectTo は open redirect を防ぐために内部パスのみ許可する。
export function sanitizeRedirectTo(redirectTo: string | null | undefined, fallback = DEFAULT_AFTER_LOGIN_PATH): string {
  if (!redirectTo || redirectTo.length === 0) {
    return fallback;
  }

  if (!redirectTo.startsWith("/") || redirectTo.startsWith("//")) {
    return fallback;
  }

  return redirectTo;
}

// buildLoginUrl はログイン画面URLを生成し、必要なら遷移元を query に保持する。
export function buildLoginUrl(redirectTo?: string): string {
  const safeRedirectTo = sanitizeRedirectTo(redirectTo, "/");
  const params = new URLSearchParams();
  params.set("redirectTo", safeRedirectTo);
  return `${LOGIN_PATH}?${params.toString()}`;
}

// requireAuthenticatedUser は未認証アクセスを検知してログイン画面へリダイレクトする。
export async function requireAuthenticatedUser(request: Request): Promise<SessionUser> {
  const user = await getUser(request);
  if (user) {
    return user;
  }

  const url = new URL(request.url);
  const redirectTo = sanitizeRedirectTo(`${url.pathname}${url.search}`, "/");
  throw redirect(buildLoginUrl(redirectTo));
}

// resolvePostLoginRedirect はログイン完了後の遷移先を安全化して返す。
export function resolvePostLoginRedirect(request: Request, fallback = DEFAULT_AFTER_LOGIN_PATH): string {
  const url = new URL(request.url);
  return sanitizeRedirectTo(url.searchParams.get("redirectTo"), fallback);
}
