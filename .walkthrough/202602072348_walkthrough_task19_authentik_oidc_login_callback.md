# Walkthrough: Task19 Authentik（OIDC）連携（ログイン/コールバック）

## 目的
- `docs/tasks.md` の Task19 を実装し、Remix 側で OIDC Authorization Code Flow によるログインを成立させる。
- `sub` をアプリの `userId` として Cookie セッションへ保存し、保護ルートで再利用できる状態にする。

## 実装内容

### 1. OIDC サービス層を追加
- 追加: `client/app/services/oidc.server.ts`
- 実装した内容:
  - OIDC Discovery（`/.well-known/openid-configuration`）の取得
  - Authorization URL 生成（`state` / `nonce` / PKCE `code_challenge`）
  - Token Endpoint での code 交換
  - JWKS 取得と ID Token 署名検証（RS256/384/512）
  - ID Token クレーム検証（`iss`, `aud`, `exp`, `nonce`, `sub`）
- 環境変数:
  - `OIDC_ISSUER_URL`
  - `OIDC_CLIENT_ID`
  - `OIDC_CLIENT_SECRET`
  - `OIDC_REDIRECT_URI`（未設定時は `request.origin + /auth/callback`）
  - `OIDC_SCOPES`（未設定時は `openid profile email`）

### 2. セッション層を拡張
- 更新: `client/app/services/session.server.ts`
- 追加した責務:
  - OIDC 一時情報（`state`, `nonce`, `codeVerifier`, `redirectTo`）の保存/取得/削除
  - `createUserSessionCookie` 実行時に OIDC 一時情報をクリア
- 追加した関数:
  - `getPendingOidcAuth`
  - `createPendingOidcAuthCookie`
  - `clearPendingOidcAuthCookie`

### 3. `/login` ルート実装
- 更新: `client/app/routes/login.tsx`
- loader:
  - 未ログイン時: OIDC 開始処理を実行し Authentik へリダイレクト
  - ログイン済み時: ログイン状態を表示
- action:
  - `intent=logout` を受け取りセッション破棄

### 4. `/auth/callback` ルート実装
- 更新: `client/app/routes/auth.callback.tsx`
- loader:
  - Provider エラー、`code/state` 欠損、state 不一致を検知
  - `completeOidcAuthorization` 実行後に `userId=sub` をセッション保存
  - 成功時は元の遷移先（`redirectTo`）へリダイレクト
  - 失敗時は OIDC 一時セッションをクリアして再ログイン導線を表示

### 5. 既存型不整合の最小修正
- 更新: `client/app/routes/questions.$id.edit.tsx`
- `loader` の `id` 未指定時レスポンスを `return json` から `throw json` に変更し、`useLoaderData` の型不整合を解消。

## 検証
- 実行: `pnpm -C client exec tsc --noEmit`
- 結果: 型エラーなし

## ドキュメント更新
- `docs/tasks.md` の Task19 を `[-]` から `[x]` に更新。
