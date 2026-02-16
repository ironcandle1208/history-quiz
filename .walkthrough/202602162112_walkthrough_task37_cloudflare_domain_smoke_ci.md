# Task37: デプロイ検証を Cloudflare 経由ドメイン中心へ切り替え

## 実施日時
- 2026-02-16 21:12（ローカル）

## 背景
- `docs/tasks.md` の未完了タスクは「37. デプロイ検証を Cloudflare 経由ドメイン中心へ切り替える（CI/Smoke）」だった。
- 既存のスモークチェックは主要導線の生存確認のみで、HTTPS リダイレクトとキャッシュバイパス設定の妥当性を自動検証できていなかった。

## 変更内容
### スクリプト更新
- `scripts/production_preflight.sh`
  - `DEPLOY_CLIENT_BASE_URL` を必須化した。
  - URL が `https://` で始まることを検証した。
  - `*.fly.dev` を拒否し、Cloudflare 公開URLの利用を強制した。
- `scripts/production_smoke_check.sh`
  - Cloudflare モード（既定）で以下を検証するように変更した。
    - `http -> https` リダイレクト
    - `/quiz`, `/login` の `cf-cache-status` が `HIT` でないこと
    - 主要導線（`/`, `/quiz`, `/login`, `/questions/new`, `/me`）
  - `SMOKE_CHECK_MODE=origin` を追加し、障害切り分け用の Origin 直疎通チェックに再利用できるようにした。

### GitHub Actions 更新
- `.github/workflows/deploy-fly.yml`
  - `workflow_dispatch` に `run_origin_direct_check` を追加した。
  - staging/production それぞれで、必要時に Origin 直疎通チェックを実行する別ジョブを追加した。
  - `DEPLOY_CLIENT_ORIGIN_BASE_URL` を任意変数として受け取るようにした。

### ドキュメント更新
- `docs/Phase2/production-operations.md`
  - スモークチェックの検証項目（HTTPS リダイレクト、キャッシュバイパス、主要導線）を明記した。
  - `*.fly.dev` を本番導線に使わないことを明記した。
  - Workflow 入力 `run_origin_direct_check` と任意変数 `DEPLOY_CLIENT_ORIGIN_BASE_URL` を追記した。
- `docs/tasks.md`
  - Task 37 を完了（`[x]`）に更新した。

## 実装判断メモ
- 通常運用は Cloudflare 公開URLで検証し、Origin 直疎通は障害切り分け時のみ手動で実行する構成に分離した。
- Cloudflare 側の誤設定を早期検知するため、`cf-cache-status` 検証をスモークチェックへ組み込んだ。

