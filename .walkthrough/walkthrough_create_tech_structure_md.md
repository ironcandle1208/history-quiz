# Walkthrough: docs/tech.md / docs/structure.md 作成

## 目的
- `docs/requirements.md` と `docs/product.md` から読み取れる技術要件・制約（HTTP/JSON、gRPC、Go バックエンド、レスポンシブ、性能/セキュリティ要件）を整理し、`docs/tech.md` と `docs/structure.md` を作成する。

## 参照した資料
- `docs/requirements.md`
- `docs/product.md`
- `.spec-workflow/templates/tech-template.md`
- `.spec-workflow/templates/structure-template.md`

## 進め方
1. 要件から確定している技術要素（通信方式、バックエンド言語、非機能要件）を抽出した。
2. フレームワーク等の未確定項目は「未確定/候補」として明示し、後で更新できる形で記述した。
3. 実装が始まったときに迷いが出やすい「責務境界」「命名規約」「ディレクトリ構成」を `docs/structure.md` にまとめた。

## 出力
- `docs/tech.md`
- `docs/structure.md`

## メモ
- 本プロジェクトではフェーズ別ドキュメントを `docs/PhaseN/` に分ける運用ルールがあるため、今後ドキュメント配置の整理が必要（現状は `docs/requirements.md` などが直下に存在）。
- 認証基盤や DB、各フレームワークは未確定のため、実装フェーズで確定後に本ドキュメントを更新する。

## 更新履歴
- 2025-12-23: Web のみ想定となったため、Client を Remix（SSR 内包）で統一し、Gateway 機能を Remix に内包する方針へ更新。
- 2025-12-23: フォーム/入力検証は `zod` + `conform` を採用し、一次検証は Remix、最終防衛は Backend の方針を追記。
- 2025-12-24: 認証基盤として Authentik（OIDC）を採用し、ローカル起動用の `infra/authentik/` を追加。
- 2025-12-24: Go Backend の DB アクセスは `sqlc` を採用する方針を追記。
- 2025-12-24: Client のパッケージマネージャーを pnpm に確定。
- 2025-12-24: デプロイを Fly.io、アプリDBを Neon（PostgreSQL）に確定。
- 2025-12-25: Backend はクリーンアーキテクチャ、Remix はレイヤードを採用する方針を追記。
- 2025-12-25: 開発方式として「ユースケース駆動 + 契約駆動（proto先行） + テストピラミッド」を追記。
- 2025-12-25: Authentik 運用（リソース管理/バックアップ/設定コード化）方針を追記。
- 2025-12-25: gRPC→HTTP のエラー変換ルール（ステータス変換表/レスポンス形式/相関ID）を追記。
