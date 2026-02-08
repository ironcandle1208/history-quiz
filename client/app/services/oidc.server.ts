// OIDC（Authorization Code Flow + PKCE）を扱うサーバー専用ロジック。
// Authentik を想定しつつ、Discovery ベースでエンドポイントを解決する。

import type { PendingOidcAuth } from "./session.server";

type OidcDiscoveryDocument = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
};

type OidcTokenResponse = {
  access_token: string;
  expires_in?: number;
  id_token: string;
  scope?: string;
  token_type: string;
};

type OidcIdTokenHeader = {
  alg: string;
  kid?: string;
  typ?: string;
};

type OidcIdTokenClaims = {
  aud: string | string[];
  exp: number;
  iat?: number;
  iss: string;
  nonce?: string;
  sub: string;
};

type OidcResolvedConfig = {
  clientId: string;
  clientSecret: string;
  issuerUrl: string;
  redirectUri: string;
  scopes: string;
};

type CachedEntry<T> = {
  expiresAt: number;
  value: T;
};

type JsonWebKeyWithKid = JsonWebKey & { kid?: string };

const CACHE_TTL_MILLISECONDS = 60 * 1000;
const discoveryCache = new Map<string, CachedEntry<OidcDiscoveryDocument>>();
const jwksCache = new Map<string, CachedEntry<JsonWebKeyWithKid[]>>();

// OidcFlowError は、ユーザー向けに安全なメッセージを返すための例外型。
export class OidcFlowError extends Error {
  constructor(
    message: string,
    public readonly status = 500,
  ) {
    super(message);
    this.name = "OidcFlowError";
  }
}

// beginOidcAuthorization は OIDC 認可リクエストURLと一時セッション情報を生成する。
export async function beginOidcAuthorization(params: {
  redirectTo: string;
  request: Request;
}): Promise<{ authorizationUrl: string; pendingAuth: PendingOidcAuth }> {
  const config = resolveOidcConfig(params.request);
  const discovery = await getOidcDiscovery(config.issuerUrl);

  const state = generateRandomUrlSafeString(32);
  const nonce = generateRandomUrlSafeString(32);
  const codeVerifier = generateRandomUrlSafeString(48);
  const codeChallenge = await createPkceCodeChallenge(codeVerifier);

  const authorizationUrl = new URL(discovery.authorization_endpoint);
  authorizationUrl.searchParams.set("client_id", config.clientId);
  authorizationUrl.searchParams.set("code_challenge", codeChallenge);
  authorizationUrl.searchParams.set("code_challenge_method", "S256");
  authorizationUrl.searchParams.set("nonce", nonce);
  authorizationUrl.searchParams.set("redirect_uri", config.redirectUri);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("scope", config.scopes);
  authorizationUrl.searchParams.set("state", state);

  return {
    authorizationUrl: authorizationUrl.toString(),
    pendingAuth: {
      codeVerifier,
      nonce,
      redirectTo: params.redirectTo,
      state,
    },
  };
}

// completeOidcAuthorization は code を token に交換し、検証済み sub を返す。
export async function completeOidcAuthorization(params: {
  code: string;
  pendingAuth: PendingOidcAuth;
  request: Request;
}): Promise<{ subject: string }> {
  const config = resolveOidcConfig(params.request);
  const discovery = await getOidcDiscovery(config.issuerUrl);
  const tokenResponse = await exchangeAuthorizationCode({
    code: params.code,
    codeVerifier: params.pendingAuth.codeVerifier,
    config,
    tokenEndpoint: discovery.token_endpoint,
  });
  const claims = await verifyAndDecodeIdToken({
    clientId: config.clientId,
    expectedIssuer: discovery.issuer,
    expectedNonce: params.pendingAuth.nonce,
    idToken: tokenResponse.id_token,
    jwksUri: discovery.jwks_uri,
  });

  return { subject: claims.sub };
}

// resolveOidcConfig は環境変数と request から OIDC 設定を解決する。
function resolveOidcConfig(request: Request): OidcResolvedConfig {
  const issuerUrl = readRequiredEnv("OIDC_ISSUER_URL");
  const clientId = readRequiredEnv("OIDC_CLIENT_ID");
  const clientSecret = readRequiredEnv("OIDC_CLIENT_SECRET");
  const configuredRedirectUri = process.env.OIDC_REDIRECT_URI;
  const redirectUri = configuredRedirectUri && configuredRedirectUri.trim().length > 0 ? configuredRedirectUri.trim() : `${new URL(request.url).origin}/auth/callback`;
  const configuredScopes = process.env.OIDC_SCOPES;
  const scopes = configuredScopes && configuredScopes.trim().length > 0 ? configuredScopes.trim() : "openid profile email";

  return {
    clientId,
    clientSecret,
    issuerUrl: normalizeIssuerUrl(issuerUrl),
    redirectUri,
    scopes,
  };
}

// readRequiredEnv は必須環境変数を取得し、未設定時はユーザー向け例外を投げる。
function readRequiredEnv(name: string): string {
  const value = process.env[name];
  if (value && value.trim().length > 0) {
    return value.trim();
  }

  throw new OidcFlowError(`OIDC 設定が不足しています。環境変数 ${name} を設定してください。`);
}

// normalizeIssuerUrl は末尾スラッシュを除去し、比較時の揺れを防ぐ。
function normalizeIssuerUrl(input: string): string {
  return input.replace(/\/+$/, "");
}

// getOidcDiscovery は Discovery ドキュメントをキャッシュ付きで取得する。
async function getOidcDiscovery(issuerUrl: string): Promise<OidcDiscoveryDocument> {
  const cacheKey = issuerUrl;
  const cached = discoveryCache.get(cacheKey);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const discoveryUrl = `${issuerUrl}/.well-known/openid-configuration`;
  const response = await fetch(discoveryUrl, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new OidcFlowError("OIDC Discovery の取得に失敗しました。Authentik の接続設定を確認してください。", 502);
  }

  const parsed = await parseJson(response) as Partial<OidcDiscoveryDocument>;
  if (
    typeof parsed.issuer !== "string" ||
    typeof parsed.authorization_endpoint !== "string" ||
    typeof parsed.token_endpoint !== "string" ||
    typeof parsed.jwks_uri !== "string"
  ) {
    throw new OidcFlowError("OIDC Discovery のレスポンス形式が不正です。", 502);
  }

  const value: OidcDiscoveryDocument = {
    authorization_endpoint: parsed.authorization_endpoint,
    issuer: parsed.issuer,
    jwks_uri: parsed.jwks_uri,
    token_endpoint: parsed.token_endpoint,
  };
  discoveryCache.set(cacheKey, {
    expiresAt: now + CACHE_TTL_MILLISECONDS,
    value,
  });
  return value;
}

// exchangeAuthorizationCode は認可コードをトークンへ交換する。
async function exchangeAuthorizationCode(params: {
  code: string;
  codeVerifier: string;
  config: OidcResolvedConfig;
  tokenEndpoint: string;
}): Promise<OidcTokenResponse> {
  const body = new URLSearchParams();
  body.set("client_id", params.config.clientId);
  body.set("client_secret", params.config.clientSecret);
  body.set("code", params.code);
  body.set("code_verifier", params.codeVerifier);
  body.set("grant_type", "authorization_code");
  body.set("redirect_uri", params.config.redirectUri);

  const response = await fetch(params.tokenEndpoint, {
    body: body.toString(),
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });
  const parsed = await parseJson(response) as Partial<OidcTokenResponse> & { error?: string };
  if (!response.ok) {
    throw new OidcFlowError("認証サーバーでトークン交換に失敗しました。時間をおいて再度お試しください。", 502);
  }
  if (typeof parsed.error === "string") {
    throw new OidcFlowError("認証サーバーからエラーが返されました。再度ログインしてください。", 401);
  }
  if (
    typeof parsed.access_token !== "string" ||
    typeof parsed.id_token !== "string" ||
    typeof parsed.token_type !== "string"
  ) {
    throw new OidcFlowError("トークンレスポンスが不正です。", 502);
  }

  return {
    access_token: parsed.access_token,
    expires_in: parsed.expires_in,
    id_token: parsed.id_token,
    scope: parsed.scope,
    token_type: parsed.token_type,
  };
}

// verifyAndDecodeIdToken は署名・クレームを検証して ID Token の payload を返す。
async function verifyAndDecodeIdToken(params: {
  clientId: string;
  expectedIssuer: string;
  expectedNonce: string;
  idToken: string;
  jwksUri: string;
}): Promise<OidcIdTokenClaims> {
  const segments = params.idToken.split(".");
  if (segments.length !== 3) {
    throw new OidcFlowError("ID Token の形式が不正です。", 401);
  }

  const [encodedHeader, encodedPayload, encodedSignature] = segments;
  const header = decodeBase64UrlJson<OidcIdTokenHeader>(encodedHeader);
  const claims = decodeBase64UrlJson<OidcIdTokenClaims>(encodedPayload);
  await verifyIdTokenSignature({
    encodedHeader,
    encodedPayload,
    encodedSignature,
    header,
    jwksUri: params.jwksUri,
  });
  validateIdTokenClaims({
    claims,
    clientId: params.clientId,
    expectedIssuer: params.expectedIssuer,
    expectedNonce: params.expectedNonce,
  });
  return claims;
}

// verifyIdTokenSignature は JWKS を用いて ID Token 署名を検証する。
async function verifyIdTokenSignature(params: {
  encodedHeader: string;
  encodedPayload: string;
  encodedSignature: string;
  header: OidcIdTokenHeader;
  jwksUri: string;
}): Promise<void> {
  const algorithm = resolveJwtAlgorithm(params.header.alg);
  const jwk = await findJwkByKid(params.jwksUri, params.header.kid);
  const key = await crypto.subtle.importKey("jwk", jwk, algorithm, false, ["verify"]);
  const signedBytes = new TextEncoder().encode(`${params.encodedHeader}.${params.encodedPayload}`);
  const signatureBytes = decodeBase64UrlBytes(params.encodedSignature);
  // subtle.verify の型制約（ArrayBuffer 固定）に合わせるためコピーを作る。
  const normalizedSignature = new Uint8Array(signatureBytes.byteLength);
  normalizedSignature.set(signatureBytes);
  const verified = await crypto.subtle.verify(algorithm, key, normalizedSignature, signedBytes);
  if (!verified) {
    throw new OidcFlowError("ID Token 署名の検証に失敗しました。", 401);
  }
}

// resolveJwtAlgorithm は JWT の alg から WebCrypto のアルゴリズム設定へ変換する。
function resolveJwtAlgorithm(alg: string): RsaHashedImportParams {
  if (alg === "RS256") {
    return { hash: "SHA-256", name: "RSASSA-PKCS1-v1_5" };
  }
  if (alg === "RS384") {
    return { hash: "SHA-384", name: "RSASSA-PKCS1-v1_5" };
  }
  if (alg === "RS512") {
    return { hash: "SHA-512", name: "RSASSA-PKCS1-v1_5" };
  }

  throw new OidcFlowError(`サポートしていない署名アルゴリズムです: ${alg}`, 401);
}

// findJwkByKid は JWKS から対応する公開鍵を特定する。
async function findJwkByKid(jwksUri: string, kid: string | undefined): Promise<JsonWebKeyWithKid> {
  const keys = await getJwksKeys(jwksUri);
  const key = kid ? keys.find((candidate) => candidate.kid === kid) : keys[0];
  if (!key) {
    throw new OidcFlowError("ID Token 検証に必要な公開鍵が見つかりません。", 401);
  }

  return key;
}

// getJwksKeys は JWKS をキャッシュ付きで取得する。
async function getJwksKeys(jwksUri: string): Promise<JsonWebKeyWithKid[]> {
  const cached = jwksCache.get(jwksUri);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const response = await fetch(jwksUri, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new OidcFlowError("公開鍵セット（JWKS）の取得に失敗しました。", 502);
  }

  const parsed = await parseJson(response) as { keys?: JsonWebKeyWithKid[] };
  if (!Array.isArray(parsed.keys) || parsed.keys.length === 0) {
    throw new OidcFlowError("公開鍵セット（JWKS）が空です。", 502);
  }

  jwksCache.set(jwksUri, {
    expiresAt: now + CACHE_TTL_MILLISECONDS,
    value: parsed.keys,
  });
  return parsed.keys;
}

// validateIdTokenClaims は nonce/issuer/audience/exp/sub を検証する。
function validateIdTokenClaims(params: {
  claims: OidcIdTokenClaims;
  clientId: string;
  expectedIssuer: string;
  expectedNonce: string;
}): void {
  const nowInSeconds = Math.floor(Date.now() / 1000);
  if (!params.claims.sub || params.claims.sub.trim().length === 0) {
    throw new OidcFlowError("ID Token の sub が不正です。", 401);
  }
  if (params.claims.iss !== params.expectedIssuer) {
    throw new OidcFlowError("ID Token の issuer が一致しません。", 401);
  }
  if (!isAudienceMatched(params.claims.aud, params.clientId)) {
    throw new OidcFlowError("ID Token の audience が一致しません。", 401);
  }
  if (typeof params.claims.exp !== "number" || params.claims.exp <= nowInSeconds - 30) {
    throw new OidcFlowError("ID Token の有効期限が切れています。", 401);
  }
  if (params.claims.nonce !== params.expectedNonce) {
    throw new OidcFlowError("nonce の検証に失敗しました。再度ログインしてください。", 401);
  }
}

// isAudienceMatched は aud が clientId を含むか判定する。
function isAudienceMatched(aud: string | string[], clientId: string): boolean {
  if (typeof aud === "string") {
    return aud === clientId;
  }
  if (Array.isArray(aud)) {
    return aud.includes(clientId);
  }

  return false;
}

// parseJson はレスポンス JSON を安全に解釈し、失敗時に OIDC 例外へ変換する。
async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new OidcFlowError("認証サーバーのレスポンスが JSON ではありません。", 502);
  }
}

// generateRandomUrlSafeString は URL に安全な乱数文字列を生成する。
function generateRandomUrlSafeString(byteLength: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return encodeBase64Url(bytes);
}

// createPkceCodeChallenge は code verifier から S256 challenge を生成する。
async function createPkceCodeChallenge(codeVerifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(codeVerifier));
  return encodeBase64Url(new Uint8Array(digest));
}

// decodeBase64UrlJson は Base64URL 文字列を JSON としてデコードする。
function decodeBase64UrlJson<T>(input: string): T {
  const text = new TextDecoder().decode(decodeBase64UrlBytes(input));
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new OidcFlowError("ID Token の JSON デコードに失敗しました。", 401);
  }
}

// decodeBase64UrlBytes は Base64URL 文字列をバイト配列へ変換する。
function decodeBase64UrlBytes(input: string): Uint8Array {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  const binary = atob(`${normalized}${padding}`);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

// encodeBase64Url はバイト配列を Base64URL 文字列へ変換する。
function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
