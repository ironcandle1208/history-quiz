# Walkthrough: Authentik（OIDC）導入方針とローカル構成追加

## 背景
- DB は Neon（PostgreSQL）を候補にしているが、Neon 自体は認証基盤を提供しない。
- 要件としてログイン（メール+パスワード）を実現し、会員登録/メール確認/パスワードリセットまで含めて OSS で揃えたい。
- アーキテクチャは Web のみ想定で、Remix（SSR+BFF）+ Go Backend（gRPC）に簡素化している。

## 決定
- 認証基盤に OSS の `Authentik` を採用する。
- 連携方式は OIDC（OpenID Connect）とし、Remix が Authorization Code Flow（PKCE 推奨）でログインを行う。

## 責務分担
- **Authentik**:
  - 会員登録（メール+パスワード）
  - メール確認
  - パスワードリセット
  - OIDC Provider としてトークンを発行
- **Remix**:
  - OIDC のコールバックを受け取り、ID トークン等を検証する
  - `sub`（Authentik のユーザー識別子）をアプリ内の `User` に紐付けする
  - ログイン状態を Cookie セッションとして保持する
  - gRPC 呼び出し時にユーザー識別子を metadata 等でバックエンドへ伝播する
- **Go Backend**:
  - 認可（所有者チェック等）とドメイン整合性の最終防衛

## 追加したファイル
- `infra/authentik/docker-compose.yml`
  - ローカル開発用の Authentik + Postgres + Redis 構成
  - コメントで用途（ローカル向け）を明示
- `infra/authentik/.env.example`
  - 初期管理者やシークレット等のサンプル
- `infra/authentik/README.md`
  - 起動方法と OIDC 設定メモ

## 更新したドキュメント
- `docs/tech.md`: 認証基盤を Authentik（OIDC）に確定し、バリデーション方針との関係も含めて整理
- `docs/design.md`: Authentik コンポーネントと OIDC 連携を設計に反映
- `docs/structure.md`: `infra/authentik/` をプロジェクト構造に追加
