# Walkthrough: Task18 Remix セッション基盤（Cookie）とログインガード

## 目的
- `docs/tasks.md` の Task18 を実装し、未認証ユーザーが保護ルートへ入れないようにする。
- `userId` を Remix サーバー側で安定して扱えるセッション基盤を整える。

## 実装内容
- `client/app/services/session.server.ts` を実装した。
  - `createCookieSessionStorage` を使って Cookie セッションを定義。
  - `httpOnly`, `sameSite=lax`, `secure(本番のみtrue)` を設定。
  - `SESSION_SECRET` を環境変数から読み込み（本番未設定時は起動時エラー）。
  - `getUserSession`, `getUser`, `requireUser`, `createUserSessionCookie`, `destroyUserSessionCookie` を追加。
- `client/app/services/auth.server.ts` を実装した。
  - `sanitizeRedirectTo` で open redirect を防止（内部パスのみ許可）。
  - `buildLoginUrl` で `/login?redirectTo=...` を組み立て。
  - `requireAuthenticatedUser` で未認証時にログイン画面へリダイレクト。
  - `resolvePostLoginRedirect` を追加（後続の OIDC コールバックで利用予定）。
- 保護対象ルートでログインガードを有効化した。
  - `client/app/routes/me.tsx`
  - `client/app/routes/questions.new.tsx`
  - `client/app/routes/questions.$id.edit.tsx`
  - 各 `loader/action` が `requireAuthenticatedUser` を呼び、`userId` をサーバー側で取得できる状態にした。

## ドキュメント更新
- `docs/tasks.md` の Task18 を `[x]` に更新した。

## 補足
- Task19（Authentik OIDC 連携）で `createUserSessionCookie` と `resolvePostLoginRedirect` を使い、ログイン完了時にセッション保存する想定。
