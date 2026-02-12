# Walkthrough: Phase1 Client（Remix）起動手順のスクリプト化

## 背景
- `docs/Phase1/local-development.md` の「4. Client（Remix）を起動する」は `pnpm install`、`.env` 作成、`pnpm dev` を手動で順番実行する必要があった。
- 初期セットアップと起動手順を 1 コマンドで再現できるようにしたい要望があった。

## 実施内容
- 追加: `scripts/run_client_remix_dev.sh`
  - `pnpm` コマンド存在確認を実施。
  - `client/.env` が無い場合は `client/.env.example` から自動生成。
  - `client` 配下で `pnpm install` を実行。
  - `client` 配下で `pnpm dev` を `exec` で起動。
  - 役割や保守意図が分かるよう、日本語コメントを記載。
- 更新: `Makefile`
  - `client-run` ターゲットを追加。
  - `help` に `client-run` の説明を追加。
- 更新: `docs/Phase1/local-development.md`
  - 4章を `make client-run` 中心の手順へ変更。
  - `client-run` が実行する内容を明記。
  - 初回 `client/.env` 生成時に必要な設定項目を継続して明示。

## 検証
- `bash -n scripts/run_client_remix_dev.sh` で構文エラーがないことを確認。
- `make help` で `client-run` が表示されることを確認。
- `make -n client-run` でスクリプト呼び出しが行われることを確認。
