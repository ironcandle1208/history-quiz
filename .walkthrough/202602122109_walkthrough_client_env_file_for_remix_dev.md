# Walkthrough: Client 起動時の環境変数を `.env` ファイル運用へ変更

## 背景
- `docs/Phase1/local-development.md` では `pnpm dev` 実行時に環境変数をインライン指定していた。
- 手順を再利用しやすくするため、`client/.env` へ事前設定する方式に変更したい要望があった。

## 実施内容
- 更新: `docs/Phase1/local-development.md`
  - Client 起動手順を以下へ変更。
    - `cp .env.example .env` で環境変数ファイルを作成
    - `.env` に必要値を設定
    - `pnpm dev` で起動
  - 既存のインライン環境変数指定コマンドを削除。

- 追加: `client/.env.example`
  - Remix ローカル起動に必要な環境変数テンプレートを追加。
  - OIDC（Issuer/Client ID/Client Secret/Redirect URI）と gRPC 接続設定を記載。

## 検証
- `client/app/services/oidc.server.ts` と `client/app/grpc/client.server.ts` が参照する環境変数キーと一致していることを確認。
- ドキュメント/テンプレート追加のみのため、アプリテストは未実施。
