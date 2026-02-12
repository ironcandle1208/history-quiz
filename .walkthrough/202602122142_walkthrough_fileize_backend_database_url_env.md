# Walkthrough: DATABASE_URL のファイル管理化（backend/.env）

## 背景
- `docs/Phase1/local-development.md` では `export DATABASE_URL=...` を都度実行する運用だった。
- シェル再起動時に設定が消えるため、ローカル開発で再利用しやすいようにファイル管理化したい要望があった。

## 実施内容
- 追加: `backend/.env.example`
  - `DATABASE_URL` と `PORT` のテンプレートを追加。
  - 役割が分かる日本語コメントを記載。
- 更新: `docs/Phase1/local-development.md`
  - DB セクションの `DATABASE_URL` 設定手順を `cp backend/.env.example backend/.env` へ変更。
  - マイグレーション手順の前に `set -a; source backend/.env; set +a` を追加。
  - Backend 起動前の前提を「`backend/.env` を shell に読み込む」に変更。
  - Backend 起動コマンドを `go run ./cmd/server` に変更（`PORT` は `backend/.env` で管理）。
  - Neon 利用時の差し替え先を `backend/.env` の `DATABASE_URL` に明記。

## 検証
- 手順内の `DATABASE_URL` 参照箇所がすべて `backend/.env` 運用と整合していることを確認。
- ドキュメント変更とテンプレート追加のみのため、アプリ実行テストは未実施。
