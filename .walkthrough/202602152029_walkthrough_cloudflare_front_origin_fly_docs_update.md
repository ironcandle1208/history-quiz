# Walkthrough: Fly Origin 維持 + Cloudflare 前段化に伴う設計ドキュメント更新

## 実施サマリ
- 2026-02-15 に、公開経路を `Cloudflare -> Fly(Origin)` とする前提へ設計・運用ドキュメントを更新した。
- あわせて、今回の構成変更で必要になる実作業を `docs/tasks.md` に追加した。

## 1) アーキテクチャ設計の更新（20:29）

### 背景
- 既存の設計書は Browser から Fly 上の Remix へ直接到達する前提で記述されていた。
- 新方針は Fly を Origin として維持しつつ、Cloudflare を公開エッジに置く構成である。

### 対応内容
- `docs/design.md` を更新した。
  - 通信経路を `Browser -> Cloudflare -> Remix(Fly) -> Backend` に変更。
  - Mermaid 図へ Cloudflare ノードを追加。
  - Components に `Cloudflare（Edge / Reverse Proxy）` を新設。

## 2) 技術スタック方針の同期（20:31）

### 背景
- `docs/tech.md` のデプロイ対象・セキュリティ前提が Fly 単独公開の説明になっていた。

### 対応内容
- `docs/tech.md` を更新した。
  - Target Platform を `Cloudflare + Fly.io` に変更。
  - Deployment Notes に Cloudflare の基本方針（Proxy / Full(strict) / HTTPS強制 / ルール管理）を追加。
  - Security Requirements / Threat Model / Decision Log / Known Limitations を Cloudflare 前段構成に合わせて更新。

## 3) セキュリティリスク定義の更新（20:33）

### 背景
- 既存のリスク記述は「Fly 側 HTTPS 強制」など、前段が Cloudflare でない前提が残っていた。

### 対応内容
- `docs/security.md` を更新した。
  - レート制御の前段を Fly から Cloudflare に変更。
  - HTTPS 強制リスクを Cloudflare の `Always Use HTTPS` / `Full (strict)` 前提へ差し替え。
  - 認証ページ誤配信を防ぐため、Cloudflare キャッシュルール未整備リスクを追加。

## 4) 本番Runbookの全面更新（20:35）

### 背景
- Runbook が Fly 直公開に寄っており、Cloudflare の運用チェックポイントが不足していた。

### 対応内容
- `docs/Phase2/production-operations.md` を Cloudflare 前段前提で更新した。
  - 対象構成に Cloudflare（公開エッジ）を追加。
  - Cloudflare 設定（DNS Proxy、TLS、Cache、WAF/Rate Limit）を事前準備へ追加。
  - ネットワーク方針、障害切り戻し、定期チェック、コスト管理に Cloudflare 観点を追加。
  - `DEPLOY_CLIENT_BASE_URL` を Cloudflare 公開URLで運用する方針を明記。

## 5) Phase2 実装計画とタスク追加（20:37）

### 背景
- 今回の構成変更により、Cloudflare 設定の再現性・運用性を担保する作業が別途必要になった。

### 対応内容
- `docs/Phase2/implementation-plan.md` の M3 対象を `Cloudflare / Fly.io / Neon / Authentik` に更新。
- `docs/tasks.md` に以下を追加。
  - 35: Cloudflare 基盤設定の IaC 化
  - 36: Cloudflare WAF / Rate Limit 導入
  - 37: Cloudflare 経由ドメイン中心の CI/Smoke 検証へ切り替え

## 変更ファイル
- `docs/design.md`
- `docs/tech.md`
- `docs/security.md`
- `docs/Phase2/production-operations.md`
- `docs/Phase2/implementation-plan.md`
- `docs/tasks.md`
- `.walkthrough/202602152029_walkthrough_cloudflare_front_origin_fly_docs_update.md`
