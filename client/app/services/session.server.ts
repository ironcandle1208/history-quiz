// Cookie セッションを扱う（サーバー専用）。
// userId の保存先をここへ集約し、ルートから Cookie 実装詳細を隠蔽する。

import { createCookieSessionStorage } from "@remix-run/node";

const SESSION_COOKIE_NAME = "history_quiz_session";
const SESSION_USER_ID_KEY = "userId";
const SESSION_OIDC_STATE_KEY = "oidcState";
const SESSION_OIDC_NONCE_KEY = "oidcNonce";
const SESSION_OIDC_CODE_VERIFIER_KEY = "oidcCodeVerifier";
const SESSION_OIDC_REDIRECT_TO_KEY = "oidcRedirectTo";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

type SessionData = {
  oidcCodeVerifier?: string;
  oidcNonce?: string;
  oidcRedirectTo?: string;
  oidcState?: string;
  userId?: string;
};

export type SessionUser = {
  // Phase1 は userId = OIDC sub の前提（docs/Phase1/decisions.md）
  userId: string;
};

export type PendingOidcAuth = {
  codeVerifier: string;
  nonce: string;
  redirectTo: string;
  state: string;
};

// resolveSessionSecrets はセッションCookie署名に使う秘密鍵を環境変数から解決する。
function resolveSessionSecrets(): string[] {
  const raw = process.env.SESSION_SECRET;
  if (raw && raw.trim().length > 0) {
    const parsedSecrets = raw
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
    if (parsedSecrets.length > 0) {
      return parsedSecrets;
    }
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET が未設定です。production では必須です。");
  }

  // 開発時の起動を止めないための暫定鍵（本番利用禁止）。
  return ["dev-only-session-secret-change-me"];
}

const sessionStorage = createCookieSessionStorage<SessionData>({
  cookie: {
    name: SESSION_COOKIE_NAME,
    httpOnly: true,
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secrets: resolveSessionSecrets(),
    secure: process.env.NODE_ENV === "production",
  },
});

// clearPendingOidcAuthOnSession は OIDC 開始時の一時情報をセッションから削除する。
function clearPendingOidcAuthOnSession(session: Awaited<ReturnType<typeof getUserSession>>): void {
  session.unset(SESSION_OIDC_STATE_KEY);
  session.unset(SESSION_OIDC_NONCE_KEY);
  session.unset(SESSION_OIDC_CODE_VERIFIER_KEY);
  session.unset(SESSION_OIDC_REDIRECT_TO_KEY);
}

// getUserSession は Cookie 文字列から Remix セッションを復元する。
export async function getUserSession(request: Request) {
  return sessionStorage.getSession(request.headers.get("Cookie"));
}

// getUser はセッションから現在ログイン中の userId を取得する。
export async function getUser(request: Request): Promise<SessionUser | null> {
  const session = await getUserSession(request);
  const userId = session.get(SESSION_USER_ID_KEY);
  if (typeof userId !== "string" || userId.trim().length === 0) {
    return null;
  }

  return { userId: userId.trim() };
}

// getPendingOidcAuth は OIDC 開始時に保存した state/nonce などを取得する。
export async function getPendingOidcAuth(request: Request): Promise<PendingOidcAuth | null> {
  const session = await getUserSession(request);
  const state = session.get(SESSION_OIDC_STATE_KEY);
  const nonce = session.get(SESSION_OIDC_NONCE_KEY);
  const codeVerifier = session.get(SESSION_OIDC_CODE_VERIFIER_KEY);
  const redirectTo = session.get(SESSION_OIDC_REDIRECT_TO_KEY);

  if (
    typeof state !== "string" ||
    typeof nonce !== "string" ||
    typeof codeVerifier !== "string" ||
    typeof redirectTo !== "string" ||
    state.trim().length === 0 ||
    nonce.trim().length === 0 ||
    codeVerifier.trim().length === 0 ||
    redirectTo.trim().length === 0
  ) {
    return null;
  }

  return {
    codeVerifier: codeVerifier.trim(),
    nonce: nonce.trim(),
    redirectTo: redirectTo.trim(),
    state: state.trim(),
  };
}

// requireUser は「ログイン必須」処理向けに user を必須取得する。
export async function requireUser(request: Request): Promise<SessionUser> {
  const user = await getUser(request);
  if (!user) {
    throw new Error("セッションにユーザー情報がありません。");
  }

  return user;
}

// createPendingOidcAuthCookie は OIDC 開始に必要な一時情報をセッションへ保存する。
export async function createPendingOidcAuthCookie(params: { pendingAuth: PendingOidcAuth; request: Request }): Promise<string> {
  const session = await getUserSession(params.request);
  session.set(SESSION_OIDC_STATE_KEY, params.pendingAuth.state);
  session.set(SESSION_OIDC_NONCE_KEY, params.pendingAuth.nonce);
  session.set(SESSION_OIDC_CODE_VERIFIER_KEY, params.pendingAuth.codeVerifier);
  session.set(SESSION_OIDC_REDIRECT_TO_KEY, params.pendingAuth.redirectTo);
  return sessionStorage.commitSession(session);
}

// clearPendingOidcAuthCookie は OIDC 一時情報だけをセッションから削除する。
export async function clearPendingOidcAuthCookie(request: Request): Promise<string> {
  const session = await getUserSession(request);
  clearPendingOidcAuthOnSession(session);
  return sessionStorage.commitSession(session);
}

// createUserSessionCookie は userId をセッションに保存した Set-Cookie 値を生成する。
export async function createUserSessionCookie(params: { request: Request; userId: string }): Promise<string> {
  const normalizedUserId = params.userId.trim();
  if (normalizedUserId.length === 0) {
    throw new Error("userId が空文字です。セッションへ保存できません。");
  }

  const session = await getUserSession(params.request);
  clearPendingOidcAuthOnSession(session);
  session.set(SESSION_USER_ID_KEY, normalizedUserId);
  return sessionStorage.commitSession(session);
}

// destroyUserSessionCookie はログアウト時にセッションを破棄する Set-Cookie 値を生成する。
export async function destroyUserSessionCookie(request: Request): Promise<string> {
  const session = await getUserSession(request);
  return sessionStorage.destroySession(session);
}
