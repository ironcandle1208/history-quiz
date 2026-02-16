# Task36: Cloudflare エッジ防御（WAF / Rate Limit）導入

## 実施日時
- 2026-02-16 21:07（ローカル）

## 背景
- `docs/tasks.md` の次タスクは「36. Cloudflare エッジ防御（WAF/Rate Limit）を導入し、状態変更系 POST を保護する」だった。
- Task35 で DNS/TLS/Cache は IaC 化済みだったため、今回は WAF とレート制限を同じ `infra/cloudflare` に統合した。

## 変更内容
### IaC 追加（Cloudflare）
- `infra/cloudflare/variables.tf`
  - allowlist / blocked IP と各 POST ルートのレート制限閾値を変数化した。
- `infra/cloudflare/main.tf`
  - `http_request_firewall_custom` ルールセットを追加。
    - 悪性 IP の固定遮断
    - Bot系 User-Agent の状態変更 POST を `managed_challenge`
    - SQLi/XSS/Path Traversal パターンを `block`
  - `http_ratelimit` ルールセットを追加。
    - `POST /login`: 10 req / 60s
    - `POST /quiz`: 60 req / 60s
    - `POST /questions/new`: 20 req / 60s
    - `POST /questions/:id/edit`: 20 req / 60s
- `infra/cloudflare/outputs.tf`
  - WAF ルール数と Rate Limit ルール数の出力を追加した。
- `infra/cloudflare/terraform.tfvars.example`
  - 運用時に調整する変数（allowlist/blocked/rate_limit）を追記した。
- `infra/cloudflare/README.md`
  - WAF/Rate Limit の初期値、必要権限、誤検知緩和手順を追記した。

### ドキュメント更新
- `docs/Phase2/production-operations.md`
  - Cloudflare の適用確認項目に WAF/Rate Limit 初期値を追加。
  - 誤検知時の一次緩和手順（Ray ID 起点、allowlist 一時追加）を追加。
  - IaC 実行時の運用入力項目を追記。
- `docs/security.md`
  - 未導入だったレート制限/TLS/キャッシュを「解消済み」として更新。
  - Task36 の運用値（閾値、WAF ルール、緩和手順）を追加。
- `docs/tech.md`
  - Cloudflare WAF/レート制限の管理先を `infra/cloudflare` に明示。
  - Known Limitations を「閾値最適化の継続調整が必要」に更新。
- `docs/tasks.md`
  - Task 36 を完了（`[x]`）へ更新。

## 実装判断メモ
- 誤検知時の運用性を優先し、レート制限アクションは `managed_challenge` を採用した。
- しきい値は最小構成で開始し、`terraform.tfvars` で環境ごとに調整可能とした。

## 次の候補
- Task 37: デプロイ検証を Cloudflare 経由ドメイン中心へ切り替える。

