# Task35: Cloudflare 前段構成の IaC 化（DNS/TLS/Cache 基本ルール）

## 実施日時
- 2026-02-16 20:58（ローカル）

## 背景
- `docs/tasks.md` の未完了先頭タスクは「35. Cloudflare 前段構成の基盤設定を IaC 化する」だった。
- `docs/tech.md` の Known Limitations にも Cloudflare IaC 未整備が残っており、手動運用ドリフトのリスクがあった。

## 変更内容
### IaC 追加
- `infra/cloudflare/versions.tf`
  - Terraform / Provider のバージョン制約を追加。
- `infra/cloudflare/variables.tf`
  - Zone ID、公開ホスト名、Fly Origin、キャッシュ対象パスを変数化。
- `infra/cloudflare/main.tf`
  - 公開 DNS（`Proxied` CNAME）を追加。
  - `Always Use HTTPS` と `SSL/TLS: Full (strict)` を Zone 設定で固定化。
  - 動的パスの `Bypass Cache` と静的配信の基本キャッシュを Page Rule で追加。
- `infra/cloudflare/outputs.tf`
  - 適用対象ホストとルール件数を出力。
- `infra/cloudflare/terraform.tfvars.example`
  - 最小入力例を追加。
- `infra/cloudflare/README.md`
  - Token 権限、実行手順、運用上の優先度ルールを記載。

### ドキュメント更新
- `docs/Phase2/production-operations.md`
  - Cloudflare 設定手順を手動操作から Terraform 実行手順へ変更。
  - 必須コマンドに `terraform` を追加。
  - Cloudflare 切り戻し手順を IaC ベースへ更新。
- `docs/tech.md`
  - Cloudflare DNS/TLS/Cache 基本ルールの管理先を `infra/cloudflare` に更新。
  - Known Limitations を「WAF/Rate Limit IaC 未整備（Task36）」へ更新。
- `docs/tasks.md`
  - Task 35 を完了（`[x]`）へ更新。

## 実装判断メモ
- Task 35 のスコープに合わせて、まずは DNS/TLS/Cache の最小セットのみを IaC 化した。
- WAF / Rate Limit は誤検知影響が大きいため、Task 36 で閾値と運用手順を含めて段階導入する前提を維持した。

## 次の候補
- Task 36: Cloudflare の WAF / Rate Limit ルールを IaC へ追加する。
- Task 37: デプロイ検証を Cloudflare 公開URL中心へ寄せる。

