# Walkthrough: デプロイを Fly.io、アプリDBを Neon に決定

## 背景
- アーキテクチャは `Remix（SSR+BFF） + Go Backend（gRPC）` の2サービス構成。
- 認証基盤として `Authentik（OIDC）` をセルフホストする方針。
- 金銭的コストと運用コストのバランスを取りつつ、公開までのリードタイムを短くしたい。

## 決定
- デプロイプラットフォームは `Fly.io` を採用する。
- アプリDB（クイズ/作問/履歴など）は `Neon（PostgreSQL）` を採用する。

## 構成（想定）
- `Browser → Remix(Fly.io) → Go Backend(Fly.io) → Neon(Postgres)`
- `Authentik(Fly.io) →（Authentik用 Postgres/Redis は Fly.io 側で別途用意）`

## ポイント
- Neon はアプリDBとして利用し、Authentik のDB/Redisとは分離する（用途と運用責務が異なるため）。
- Fly.io はコンテナで統一的に運用できるため、Remix/Go/Authentik を同一プラットフォームで揃えられる。

## 更新したドキュメント
- `docs/tech.md`: `Fly.io` / `Neon` を採用として確定、デプロイノートを追記
- `docs/design.md`: DB を `PostgreSQL / Neon` として明記
