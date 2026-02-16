# Cloudflare IaC（Task 35 / 36）

## 目的
- Cloudflare 前段構成（DNS / TLS / Cache）とエッジ防御（WAF / Rate Limit）を Terraform で固定し、手動設定ドリフトを防ぐ。

## 管理対象
- 公開 DNS レコード（`Proxied` な CNAME）
- `Always Use HTTPS`
- `SSL/TLS: Full (strict)`
- 動的パスの `Bypass Cache`
- 静的配信パスの基本キャッシュ
- カスタム WAF（Bot/悪性IP/異常パターン）
- 状態変更系 POST の Rate Limit

## 事前準備
1. Terraform をインストールする。
2. Cloudflare API Token を用意する。
  - 最低限必要な権限:
    - `Zone:Read`
    - `DNS:Edit`
    - `Zone Settings:Edit`
    - `Page Rules:Edit`
    - `Zone WAF:Edit`
    - `Zone Rulesets:Edit`
3. 環境変数を設定する。

```bash
export CLOUDFLARE_API_TOKEN="<your-cloudflare-api-token>"
```

## 使い方
1. 変数ファイルを作成する。

```bash
cd infra/cloudflare
cp terraform.tfvars.example terraform.tfvars
```

2. `terraform.tfvars` の値を更新する。
- `zone_id`
- `public_hostname`
- `fly_origin_hostname`
- `waf_allowlist_ip_cidrs`（誤検知緩和が必要な運用IP）
- `waf_blocked_ip_cidrs`（恒久ブロック対象IP）
- `rate_limit_*`（各POSTルートの閾値）

3. Plan / Apply を実行する。

```bash
terraform init
terraform plan
terraform apply
```

## ルール優先度
- 動的パスの `Bypass Cache` は優先度 `10` 番台
- 静的配信キャッシュは優先度 `100` 番台

この順序により、ログイン後ページなどの誤キャッシュを避ける。

## WAF / Rate Limit 初期ルール
- WAF:
  - Bot系 User-Agent で状態変更 POST を試行したアクセスを `managed_challenge`
  - SQLi/XSS/Path Traversal に該当する異常クエリを `block`
  - `waf_blocked_ip_cidrs` に登録した IP/CIDR を `block`
- Rate Limit（`period=60s`）:
  - `POST /login`: 10 req / 60s / IP
  - `POST /quiz`: 60 req / 60s / IP
  - `POST /questions/new`: 20 req / 60s / IP
  - `POST /questions/:id/edit`: 20 req / 60s / IP

## 誤検知時の緩和
1. 運用端末の CIDR を `waf_allowlist_ip_cidrs` に追加する。
2. `terraform apply` を実行する。
3. 収束後に CIDR を削除して再度 `terraform apply` する。
