// Cookie セッションを扱う（サーバー専用）。
// userId の保存先をここへ集約し、ルートから Cookie 実装詳細を隠蔽する。

import { createCookieSessionStorage } from "@remix-run/node";

const SESSION_COOKIE_NAME = "history_quiz_session";
const SESSION_USER_ID_KEY = "userId";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

type SessionData = {
  userId?: string;
};

export type SessionUser = {
  // Phase1 は userId = OIDC sub の前提（docs/Phase1/decisions.md）
  userId: string;
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

// requireUser は「ログイン必須」処理向けに user を必須取得する。
export async function requireUser(request: Request): Promise<SessionUser> {
  const user = await getUser(request);
  if (!user) {
    throw new Error("セッションにユーザー情報がありません。");
  }

  return user;
}

// createUserSessionCookie は userId をセッションに保存した Set-Cookie 値を生成する。
export async function createUserSessionCookie(params: { request: Request; userId: string }): Promise<string> {
  const normalizedUserId = params.userId.trim();
  if (normalizedUserId.length === 0) {
    throw new Error("userId が空文字です。セッションへ保存できません。");
  }

  const session = await getUserSession(params.request);
  session.set(SESSION_USER_ID_KEY, normalizedUserId);
  return sessionStorage.commitSession(session);
}

// destroyUserSessionCookie はログアウト時にセッションを破棄する Set-Cookie 値を生成する。
export async function destroyUserSessionCookie(request: Request): Promise<string> {
  const session = await getUserSession(request);
  return sessionStorage.destroySession(session);
}
