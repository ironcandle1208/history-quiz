# Phase2 コスト監視ガイド（Fly.io / Cloudflare）

## 目的
- 週次でコスト増加を早期検知し、請求確定前に是正できる運用にする。
- `docs/security.md` のコスト関連リスク（C-5）を運用手順として固定化する。

## 週次チェック手順
1. Fly.io ダッシュボードで `Usage` / `Billing` を開き、以下を記録する。
- 月次累計（USD）
- 直近7日間コスト（USD）
- 前週7日間コスト（USD）
- remote build 回数
2. Cloudflare ダッシュボードで以下を記録する。
- 全体リクエスト数
- WAF ブロック件数
- Rate Limit ヒット件数
- 課金対象機能の使用量（有効化している場合）
3. `docs/Phase2/production-operations.md` の閾値に照らして判定する。

## 判定閾値
- 警告:
  - 前週比 `+20%` 超
  - 月次予算消化率 `80%` 超
- 重大:
  - 月次予算超過見込み（予測 `100%` 超）

## 閾値超過時アクション
1. `production` 責任者へ即時連絡する。
2. staging の自動デプロイ頻度を一時的に抑制する。
3. staging の常時起動設定（`min_machines_running` / `auto_stop_machines`）を見直す。
4. 変更種別に応じて migration / smoke の実行ポリシーを見直す。
5. Authentik の同時稼働要否を再判定し、不要なら停止する。

## 週次記録テンプレート
```md
## 週次コスト記録（YYYY-MM-DD）
- 実施者:
- 対象環境: staging / production
- Fly 月次累計（USD）:
- Fly 直近7日（USD）:
- Fly 前週7日（USD）:
- Fly remote build 回数（週次）:
- Cloudflare リクエスト数:
- Cloudflare WAF ブロック数:
- Cloudflare Rate Limit ヒット数:
- 判定: 正常 / 警告 / 重大
- 実施アクション:
- 備考:
```
