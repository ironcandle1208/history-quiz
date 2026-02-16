# Cloudflare IaC（Task 35）

## 目的
- Cloudflare 前段構成（DNS / TLS / Cache 基本ルール）を Terraform で固定し、手動設定ドリフトを防ぐ。

## 管理対象
- 公開 DNS レコード（`Proxied` な CNAME）
- `Always Use HTTPS`
- `SSL/TLS: Full (strict)`
- 動的パスの `Bypass Cache`
- 静的配信パスの基本キャッシュ

## 事前準備
1. Terraform をインストールする。
2. Cloudflare API Token を用意する。
  - 最低限必要な権限:
    - `Zone:Read`
    - `DNS:Edit`
    - `Zone Settings:Edit`
    - `Page Rules:Edit`
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

## 今後の拡張（Task 36）
- WAF ルール
- レート制限
- 誤検知時の緩和ルール

