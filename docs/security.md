# セキュリティリスクチェックリスト（L7 / HTTP）

最終更新日: 2026-02-16

## 今回判明したリスク

- [ ] `中` 共通セキュリティヘッダが未整備
  - 想定影響: クリックジャッキング、XSS被害拡大、意図しない情報送信を抑止しづらい。
  - 確認箇所: `client/app/entry.server.tsx`
  - 補足: `Content-Type` 以外（`Content-Security-Policy`、`X-Frame-Options` or `frame-ancestors`、`X-Content-Type-Options`、`Referrer-Policy`、`Permissions-Policy`、`Strict-Transport-Security`）が未設定。

- [x] `中` レート制限・スロットリングが未導入（2026-02-16 解消）
  - 対応内容: `infra/cloudflare` の Terraform で状態変更系 `POST` 向けレート制限を導入した。
  - 確認箇所: `infra/cloudflare/main.tf`, `infra/cloudflare/variables.tf`, `docs/Phase2/production-operations.md`

- [ ] `中` HTTPリクエストボディサイズの上限未設定
  - 想定影響: 大きなフォーム投稿によるメモリ/CPU圧迫のリスク。
  - 確認箇所: `client/app/routes/quiz.tsx`, `client/app/routes/questions.new.tsx`, `client/app/routes/questions.$id.edit.tsx`

- [x] `中` Cloudflare 側 HTTPS 強制 / TLS モードの標準化不足（2026-02-16 解消）
  - 対応内容: `infra/cloudflare` の Terraform で `Always Use HTTPS` と `SSL/TLS: Full (strict)` を固定化した。
  - 確認箇所: `infra/cloudflare/main.tf`, `docs/Phase2/production-operations.md`

- [x] `中` Cloudflare キャッシュルール未整備（認証済みページの誤キャッシュ）（2026-02-16 解消）
  - 対応内容: 動的パス `Bypass Cache` と静的配信キャッシュを Terraform で固定化した。
  - 確認箇所: `infra/cloudflare/main.tf`, `docs/Phase2/production-operations.md`

## 対応方針（2026-02-15時点）

| No | 対象リスク | 優先度 | 対応方針 | 完了条件（受け入れ基準） |
|---|---|---|---|---|
| 1 | 共通セキュリティヘッダ未整備 | 高 | `client/app/entry.server.tsx` で共通ヘッダを付与する。最低限 `Content-Security-Policy`、`X-Frame-Options`（または `frame-ancestors`）、`X-Content-Type-Options`、`Referrer-Policy`、`Permissions-Policy`、`Strict-Transport-Security` を適用する。 | `curl -I` で全主要ページ（`/`, `/quiz`, `/me`, `/login`）に同一ヘッダが付与される。CSP違反で画面崩れやログイン不全がない。 |
| 2 | レート制限・スロットリング未導入 | 高 | エッジ（Cloudflare）とアプリ側の二段で制御する。まず状態変更系 `POST`（`/login`, `/quiz`, `/questions/new`, `/questions/:id/edit`）に制限を入れる。認証開始（OIDC）と作問APIを優先対象にする。 | 上限超過時に `429` を返し、通常利用では誤検知が発生しない。超過ログ（IP/UA/パス/時刻）を追跡できる。 |
| 3 | HTTPリクエストボディサイズ上限未設定 | 中 | インフラ層とアプリ層の両方で上限を設ける。アプリ側では `Content-Length` を検査し、上限超過を `413` で拒否する。フォーム項目の文字数上限もスキーマで維持する。 | 想定上限を超えるリクエストで `413` を返す。通常フォーム送信に影響しない。負荷試験でメモリスパイクが抑制される。 |
| 4 | Cloudflare 側 HTTPS 強制 / TLS 標準化不足 | 中 | Cloudflare 側で `Always Use HTTPS` と `SSL/TLS: Full (strict)` を必須化し、運用Runbook（`docs/Phase2/production-operations.md`）へ反映する。 | `http://` でアクセスした際に常に `https://` へリダイレクトされ、Origin 接続も `Full (strict)` で維持される。 |
| 5 | Cloudflare キャッシュルール未整備 | 中 | Cloudflare で `/quiz`, `/me`, `/login`, `/auth/*`, `/questions/*` を `Bypass cache` に設定し、静的アセットのみキャッシュ対象にする。 | 認証済みページで `cf-cache-status: BYPASS` が確認でき、静的配信では `HIT` が確認できる。 |

## 実施順序（推奨）

1. 共通セキュリティヘッダの導入
2. Cloudflare 側 HTTPS 強制 / TLS 標準化
3. レート制限・スロットリング導入
4. ボディサイズ上限の導入
5. Cloudflare キャッシュルール整備

## Cloudflare エッジ防御の運用値（Task 36）

### レート制限（初期値）
- `POST /login`: `10 req / 60s / IP`（`managed_challenge`）
- `POST /quiz`: `60 req / 60s / IP`（`managed_challenge`）
- `POST /questions/new`: `20 req / 60s / IP`（`managed_challenge`）
- `POST /questions/:id/edit`: `20 req / 60s / IP`（`managed_challenge`）

### WAF 最小セット
- Bot系 User-Agent で状態変更 POST を試行した場合は `managed_challenge`
- SQLi/XSS/Path Traversal を含む異常クエリは `block`
- `waf_blocked_ip_cidrs` に登録した IP/CIDR は `block`

### 誤検知時の一次緩和
1. Cloudflare Events で一致ルールを特定する。
2. `waf_allowlist_ip_cidrs` に運用端末 CIDR を一時追加して `terraform apply` する。
3. 閾値または式を修正し、収束後に一時 allowlist を削除する。

## Fly.io コスト増大リスク（運用）

- [ ] `高` 常時起動設定による固定費高止まりリスク
  - 想定影響: 低トラフィック時間帯でも課金が継続し、月次コストが下がりにくい。
  - 確認箇所: `infra/fly/client.fly.toml`, `infra/fly/backend.fly.toml`
  - 補足: `client` は `min_machines_running = 1`、`backend` は `auto_stop_machines = "off"` かつ `min_machines_running = 1`。

- [ ] `高` デプロイ頻度増加によるビルド課金リスク
  - 想定影響: `main` への更新回数に比例して remote build 実行コストが増える。
  - 確認箇所: `.github/workflows/deploy-fly.yml`, `scripts/deploy_production_fly.sh`
  - 補足: `push` で staging 自動デプロイ、`flyctl deploy --remote-only` を利用。

- [ ] `中` migration / smoke の既定有効による実行コスト増加リスク
  - 想定影響: デプロイごとの付随処理が増え、CI・実行時間・外部アクセスが積み上がる。
  - 確認箇所: `.github/workflows/deploy-fly.yml`, `scripts/deploy_production_fly.sh`, `scripts/production_smoke_check.sh`

- [ ] `中` Authentik 同時運用時の追加固定費リスク
  - 想定影響: 認証基盤アプリ分のランニング費が恒常的に増える可能性。
  - 確認箇所: `docs/Phase2/production-operations.md`, `scripts/deploy_production_fly.sh`

- [ ] `中` コスト監視・予算アラート運用未整備リスク
  - 想定影響: 異常増加の早期検知が遅れ、請求確定後に気づく運用になる。
  - 確認箇所: `docs/Phase2/production-operations.md`

## 対応方針（Fly.io コスト）

| No | 対象リスク | 優先度 | 対応方針 | 完了条件（受け入れ基準） |
|---|---|---|---|---|
| C-1 | 常時起動設定による固定費高止まり | 高 | staging は `min_machines_running=0` を検討し、`backend` の `auto_stop_machines` を段階的に見直す。production はSLOを満たす最小台数を再評価する。 | staging の月次利用額が削減し、必要な可用性（起動遅延許容範囲）を維持できる。 |
| C-2 | デプロイ頻度増加によるビルド課金 | 高 | staging 自動デプロイ条件を絞る（対象パス再検討、手動実行併用）。高頻度変更時はバッチ化してデプロイ回数を抑える。 | 週次デプロイ回数と remote build 回数を可視化し、基準値を超えない。 |
| C-3 | migration / smoke の実行コスト | 中 | 変更種別に応じて `run_migrations` と `run_smoke_check` を使い分ける運用に変更し、不要実行を削減する。 | DB変更のないデプロイで migration が走らない。最低限必要な smoke は維持しつつ平均実行時間が短縮する。 |
| C-4 | Authentik 同時運用時の固定費増分 | 中 | `DEPLOY_AUTHENTIK` の有効化条件を明文化し、未使用環境では停止または別運用に分離する。 | staging/production で Authentik の稼働要否が文書化され、不要環境で課金が発生しない。 |
| C-5 | 監視・予算アラート未整備 | 高 | Fly.io の usage/billing 確認手順、予算アラート閾値、超過時エスカレーションを Runbook に追加する。 | 週次チェック項目にコスト監視が入り、閾値超過時の担当・手順が定義される。 |

## 実施順序（Fly.io コスト・推奨）

1. コスト監視・予算アラート運用の整備（C-5）
2. 常時起動設定の見直し（C-1）
3. デプロイ頻度と remote build 回数の最適化（C-2）
4. migration/smoke 実行ポリシー最適化（C-3）
5. Authentik 運用範囲の整理（C-4）

## メモ

- CSRFトークン検証、セッションCookie属性、Open Redirect対策は実装済み。
- 上記は「今回判明したリスク」の記録を目的とし、優先度は運用状況に応じて見直す。
