# Walkthrough: Phase1 Backend（Go / gRPC）起動手順のスクリプト化

## 背景
- `docs/Phase1/local-development.md` の「3. Backend（Go / gRPC）を起動する」は `backend/.env` 読み込みと `go run` を手動で順番実行する必要があった。
- 起動時の環境変数読み込み漏れを防ぎ、1 コマンドで再現できるようにしたい要望があった。

## 実施内容
- 追加: `scripts/run_backend_grpc_server.sh`
  - `go` コマンド存在確認を実施。
  - `backend/.env` が無い場合は `backend/.env.example` から自動生成。
  - `set -a; source backend/.env; set +a` で環境変数を読み込み。
  - `DATABASE_URL` 未設定時は明示的に失敗。
  - `cd backend && go run ./cmd/server` を `exec` で実行。
- 更新: `Makefile`
  - `backend-run` ターゲットを追加。
  - `help` に `backend-run` の説明を追加。
- 更新: `docs/Phase1/local-development.md`
  - 3章を `make backend-run` 中心の手順へ変更。
  - `backend-run` が実行する内容を明記。

## 検証
- `bash -n scripts/run_backend_grpc_server.sh` で構文エラーがないことを確認。
- `make help` で `backend-run` が表示されることを確認。
- `make -n backend-run` でスクリプト呼び出しが行われることを確認。
