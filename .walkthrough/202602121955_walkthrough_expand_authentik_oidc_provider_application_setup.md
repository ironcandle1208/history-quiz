# Walkthrough: local-development の OIDC Provider/Application 手順詳細化

## 背景
- `docs/Phase1/local-development.md` の「1-5 OIDC Provider / Application を作成」が簡略的で、Authentik 管理画面での具体設定が不足していた。

## 実施内容
- 更新: `docs/Phase1/local-development.md`
  - 1-5 を以下の構成で詳細化。
    - Provider 作成手順（画面パス付き）
    - ローカル向け推奨設定例
      - `default-provider-authorization-implicit-consent`
      - `Confidential`
      - `http://localhost:3000/auth/callback`
    - Provider 作成後に控える値（slug / client id / secret / issuer）
    - Application 作成手順と推奨設定例
    - Remix 側環境変数への反映項目
  - 併せて、本番では explicit consent の検討が必要である旨を補足。

## 検証
- `client/app/services/oidc.server.ts` の環境変数要件（`OIDC_ISSUER_URL`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_REDIRECT_URI`）と整合する記述であることを確認。
- ドキュメント変更のみのため、アプリテストは未実施。
