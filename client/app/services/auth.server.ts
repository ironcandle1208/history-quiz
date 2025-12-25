// 認証（OIDC）関連のサーバー専用ロジックをまとめる。
// 例: 認証開始URL生成、コールバック処理、ログアウト等。

// buildLoginUrl は OIDC のログイン開始URLを生成する。
export function buildLoginUrl(): string {
  // TODO: Authentik の OIDC 設定（issuer/client_id 等）を参照してURLを構築する
  return "/login";
}

