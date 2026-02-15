# Technology Stack

## Project Type
- Web アプリケーション（学習用 4 択クイズ + 問題作成 + マイページ）
- アーキテクチャは Browser / Cloudflare / Remix（SSR + BFF） / Go Backend の2サービス構成（Gateway 機能は Remix に内包）

## Core Technologies

### Primary Language(s)
- **Client**: TypeScript（Remix + React。ブラウザ実行 + SSR を含む）
- **Backend**: Go（gRPC サーバー）
- **IDL**: Protocol Buffers（gRPC 定義）

※クライアントは Remix（React）で統一する方針とする（Web のみ想定のため）。

### Key Dependencies/Libraries
- **Client**: Remix、React、フォーム/バリデーション（`zod` + `conform`）
- **Client（サーバー側）**: gRPC クライアント（`@grpc/grpc-js`）、OIDC 処理、Protocol Buffers 生成物
- **Backend**: gRPC（`google.golang.org/grpc`）、DB アクセス（`pgx`）、共通エラー型（`apperror`）
- **Proto Tooling**: `buf`（lint / codegen）

### Application Architecture
- **Client-Server**: ブラウザは HTTPS で Cloudflare を経由し、Fly 上の Remix（SSR サーバー）へアクセスする
- **BFF + gRPC Backend**: Remix（BFF）が gRPC で Go バックエンドに処理を委譲する
- **責務分離**:
  - Browser: 表示・入力・UX
  - Cloudflare: 公開エッジ、TLS、WAF、レート制御、キャッシュ制御
  - Remix（SSR+BFF）: ルーティング/SSR、認証、入力バリデーション、HTTP レスポンス整形、gRPC 呼び出し
  - Backend: ドメインロジック、認可（所有者チェック等）、永続化

#### gRPC 呼び出し方針（重要）
- gRPC は **Remix のサーバーサイド（Node.js）からのみ**呼び出す（ブラウザから Backend を直接叩かない）
- そのため、Remix 側の gRPC クライアントは `@grpc/grpc-js` を採用する
- 将来的に「ブラウザから直接 RPC を呼びたい」要件が出た場合は、gRPC-Web / Connect / HTTP API の追加を別途検討する

### Data Storage (if applicable)
- **Primary storage**: RDB（PostgreSQL / `Neon` を採用）
- **Caching**: 初期は不要（将来、負荷や分析要件に応じて導入検討）
- **Data formats**:
  - HTTP: JSON
  - gRPC: Protocol Buffers

### Data Lifecycle（削除方針）
- 過去データの整合性（解答履歴/正答率）を保つため、`Question` は `deleted_at`（論理削除）を採用する
- 一覧/出題クエリは `deleted_at IS NULL` を標準とする（Repository のクエリで徹底する）

### External Integrations (if applicable)
- **Protocols**: HTTPS（Browser→Cloudflare→Remix）、gRPC（Remix→Backend）
- **Edge/Network**:
  - Cloudflare を前段プロキシとして利用し、Fly の `client` は Origin として運用する
  - 公開ドメインは Cloudflare 配下を正とし、運用上の疎通確認・監視も同一ドメインを利用する
- **Authentication**:
  - 認証基盤は OSS の `Authentik` を採用し、OIDC（OpenID Connect）で Remix と連携する
  - ログイン状態は Remix が Cookie セッションとして保持する（Web のみ想定のため）
  - Remix は OIDC の `sub`（Authentik のユーザー識別子）をアプリ内ユーザーIDへ紐付けし、gRPC の metadata 等でバックエンドへユーザー識別子を伝播する
  - Authentik はメール+パスワードの会員登録、メール確認、パスワードリセット等を担当する（フローは Authentik 側で設定）

### Monitoring & Dashboard Technologies (if applicable)
- **Dashboard Framework**: Web（マイページ）
- **Real-time Communication**: 初期は不要（操作起点の更新）
- **Visualization Libraries**: 初期はシンプル表示（将来グラフ化を検討）

## Development Environment

### Build & Development Tools
- **Package Management**: pnpm（Client）、go mod（Backend）
- **Development workflow**: `make` 経由で DB/Backend/Client を起動し、Client は `pnpm dev`、Backend は `go run` を利用
- **Proto generation**: `buf`（`proto/buf.gen.yaml`）

### Code Quality Tools
- **Static Analysis**: ESLint（TS）を利用（Go lint は Phase2 で整備予定）
- **Formatting**: Prettier（TS）、gofmt（Go）
- **Testing Framework**: Vitest（Client）、Go 標準 testing（Backend）
- **Documentation**: Markdown（`docs/`、`.walkthrough/`）

## Development Approach
- ユースケース駆動（縦切り）で、1機能を UI（Remix）→ gRPC → Backend → DB まで通して作る
- 契約駆動（`proto` 先行）で境界の手戻りを減らす
- テストはテストピラミッド（Unit中心 + 主要経路のIntegration + 最小限のE2E）

### Version Control & Collaboration
- **VCS**: Git
- **Branching Strategy**: 未確定（小規模開始を想定し、trunk-based か GitHub Flow を候補）
- **Code Review Process**: PR ベース（未確定）

## Deployment & Distribution (if applicable)
- **Target Platform(s)**: `Cloudflare`（Edge） + `Fly.io`（Origin: Remix / Go Backend / Authentik）
- **Distribution Method**: Web 配信（HTTPS）
- **Update Mechanism**: `scripts/production_preflight.sh` / `scripts/production_sync_fly_secrets.sh` / `scripts/deploy_production_fly.sh` を共通手順とし、GitHub Actions（`.github/workflows/deploy-fly.yml`）から `staging` 自動・`production` 手動承認で実行する

### Deployment Notes
- **Cloudflare（公開エッジ）**:
  - DNS は Cloudflare Proxy（orange cloud）を有効化する
  - SSL/TLS モードは `Full (strict)` を採用し、`Always Use HTTPS` を有効化する
  - WAF / レート制限 / キャッシュルールは Runbook（`docs/Phase2/production-operations.md`）に従って管理する
- **Remix**: Fly.io のアプリとしてデプロイ（SSR + BFF）
  - Dockerfile: `client/Dockerfile`
  - Fly 設定: `infra/fly/client.fly.toml`
- **Go Backend**: Fly.io のアプリとしてデプロイ（gRPC サーバー）
  - Dockerfile: `backend/Dockerfile`
  - Fly 設定: `infra/fly/backend.fly.toml`
  - 公開ポートは持たず、`*.internal` 経由の内部通信を前提にする
- **Authentik**:
  - Fly.io 上でコンテナとして稼働させる
  - Authentik 用の Postgres/Redis は Fly.io のマネージド Postgres/Redis 等で別途用意する（アプリDBの Neon とは別）
  - Authentik の設定（OIDC Provider / Application / Flow 等）は Blueprints 等でコード化し、リポジトリで管理する（手作業設定の属人化を避ける）
- **Neon**: アプリ用の PostgreSQL として利用する（`backend` から接続）
  - `DATABASE_URL` は `sslmode=require` を必須とする
  - マイグレーション適用は `scripts/apply_db_migrations.sh` を利用する

### Production Runbook
- 本番運用の単一Runbookは `docs/Phase2/production-operations.md` を参照する。
- Fly アプリ名・設定ファイルは `infra/fly/apps.env` で管理する。
- Cloudflare のゾーン設定・ルールは Runbook に定義したチェックリストで管理する。
- デプロイ前後は `make production-preflight` / `make production-smoke` で確認する。

### Authentik Ops（リソース管理とバックアップ）
Fly.io 上で Authentik を運用する際は、以下を早期に確定する。

- **リソース管理**
  - Authentik 本体、Authentik 用 Postgres、Redis をそれぞれ独立にスケール/監視する
  - まずは最小構成で開始し、メモリ不足/レスポンス悪化が見えたらスケールする（初期から過剰に盛らない）
- **バックアップ（最低限）**
  - Authentik の永続データは Postgres にあるため、Postgres をバックアップ対象の中心に置く
  - マネージド Postgres のスナップショット（自動バックアップ）を有効化する
- **バックアップ（推奨）**
  - スナップショットに加えて、定期的に論理バックアップ（例: `pg_dump`）を取得し、別ストレージに保管する
  - リストア手順（検証環境への復元）を用意し、定期的に復元テストを行う
- **Redis の扱い**
  - Redis はキャッシュ/キュー用途であり、原則として永続データのバックアップ対象にはしない（必要なら設定を明文化する）

## Technical Requirements & Constraints

### Performance Requirements
- クイズ取得と判定結果の表示は平均 500ms 以内（ローカル環境目標）
- 作成済み問題の登録は平均 1s 以内（ローカル環境目標）

### Compatibility Requirements
- **Platform Support**: モバイルを含むレスポンシブ UI（ブラウザ）
- **Standards Compliance**: HTTP/JSON、gRPC（Protocol Buffers）

### Security & Compliance
- **Security Requirements**:
  - 入力値はサーバー側でバリデーションする
    - 基本方針: Remix（action/loader）で `zod` による一次検証を行い、`conform` を使ってフォームにエラーを返す（UX 最適化）
    - Backend（Go）は最終防衛として、整合性/認可/ドメイン不変条件（例: 選択肢4つ、正解が選択肢内、重複選択肢禁止、所有者チェック等）を必ず検証する
  - 認証トークンの取り扱い方針を設計時に明確化する（保存場所、期限、更新、失効）
  - 認可として「ユーザー自身のデータのみ参照・編集」を保証する
  - 公開経路は Cloudflare 配下へ統一し、TLS 設定は `Full (strict)` を維持する
- **Threat Model**:
  - 不正な入力（バリデーション回避）
  - 他人の問題/履歴へのアクセス（ID 推測、権限昇格）
  - トークン漏洩・セッション固定（トークン保護）
  - キャッシュ設定不備による認証済みコンテンツの誤配信

### Scalability & Reliability
- **Expected Load**: 初期は小規模想定（学習用途）
- **Availability Requirements**: 未確定（後から SLO 設定）
- **Reliability**:
  - エラー時は明確なメッセージを返し、再試行可能にする

## Error Handling Standards
gRPC（Backend）と HTTP（Remix）でエラー表現が分かれるため、境界での変換ルールを標準化する。

### gRPC → HTTP ステータス変換（Remix 側）
Remix は gRPC の status code を受け取り、以下の HTTP ステータスへ変換して返す。

| gRPC status | HTTP | 用途 |
|---|---:|---|
| `INVALID_ARGUMENT` | 400 | 入力不正（Backend側検証） |
| `FAILED_PRECONDITION` | 409 | 状態不整合（例: 更新前提の破綻） |
| `OUT_OF_RANGE` | 400 | 範囲外 |
| `NOT_FOUND` | 404 | リソースが存在しない |
| `ALREADY_EXISTS` | 409 | 重複（例: 一意制約） |
| `PERMISSION_DENIED` | 403 | 認可違反（所有者チェック等） |
| `UNAUTHENTICATED` | 401 | 未認証 |
| `RESOURCE_EXHAUSTED` | 429 | レート制限/枯渇 |
| `ABORTED` | 409 | 競合/中断 |
| `DEADLINE_EXCEEDED` | 504 | タイムアウト |
| `UNAVAILABLE` | 503 | 一時的な利用不可 |
| `UNIMPLEMENTED` | 501 | 未実装 |
| `INTERNAL` / `UNKNOWN` / `DATA_LOSS` | 500 | サーバー内部エラー |

※`CANCELLED` はクライアント切断等で発生し得るため、原則としてユーザー向けレスポンスは返せない前提でログに記録する。

### HTTP エラーレスポンス形式（Remix → Browser）
JSON で返す場合は、以下の形を基本とする（実装でキー名は統一する）。

```
{
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "権限がありません",
    "details": {}
  }
}
```

### 相関ID（Request ID）
- Remix はリクエストごとに相関IDを付与し、ログおよびエラーレスポンスに含める（例: `x-request-id`）。
- gRPC 呼び出し時は metadata に相関IDを伝播する。

## Technical Decisions & Rationale

### Decision Log
1. **Remix 採用（SSR 内包）**: Web のみ想定で、ルーティング/SSR/フォーム処理を一貫させ保守性を高めるため
2. **Gateway の別サービス化はしない**: Web のみ想定のため、BFF（認証・入力整形・gRPC 呼び出し）を Remix に内包し運用コストを下げる
3. **HTTPS（Browser→Cloudflare→Remix）**: Fly を Origin として維持しつつ、公開エッジの防御と配信制御を Cloudflare へ集約するため
4. **gRPC（Remix→Go Backend）**: 型安全な契約、低遅延、バックエンドの責務分離を強化するため
5. **`zod` + `conform`（フォーム/入力検証）**: サーバー側検証を前提にしつつ、フィールド単位のエラー表示とフォーム実装の重複を減らすため
6. **Authentik（OIDC）**: OSS で「会員登録/メール確認/パスリセット」まで含む認証基盤を揃え、アプリ側の認証実装と運用リスクを下げるため
7. **`sqlc`（DBアクセス、段階導入）**: 生SQLを単一の真実として管理する方針を維持しつつ、Phase1 は `pgx` 実装を優先し、段階的に生成コードへ寄せるため
8. **pnpm（パッケージ管理）**: 依存関係のインストール速度と一貫性を高め、開発体験を安定させるため
9. **Neon（PostgreSQL）**: アプリDBをマネージドで運用し、バックアップや可用性を委譲するため
10. **Fly.io（デプロイ）**: Remix/Go/Authentik をコンテナで統一的に運用でき、MVPの公開コストと運用コストのバランスが良いため
11. **gRPC-JS（`@grpc/grpc-js`）**: BFF 構成でサーバー側からのみ gRPC を呼ぶため、Node.js 向け実装を採用する
12. **gRPC→HTTP 変換ルールの標準化**: 一貫したエラーレスポンスと運用容易性（調査/復旧）を確保するため
13. **`deleted_at`（論理削除）**: 解答履歴/正答率の整合性を壊さず、運用上の削除ニーズに対応するため
14. **Cloudflare 前段構成**: Fly 上のアプリを Origin として維持しながら、TLS/WAF/レート制御をエッジで統一運用するため

## Known Limitations
- 監視・可観測性（メトリクス/トレース）は初期スコープ外（必要に応じて追加）
- Cloudflare 設定の IaC 化（Terraform 等）は未整備で、現時点では Runbook ベースの運用が中心
- Authentik をセルフホストする場合、Authentik 用の Postgres/Redis を別途運用する必要がある（アプリDBの Neon とは別）
- Authentik の Fly.io 本番 `fly.toml` は環境依存（外部DB/Redis構成）なので、本リポジトリではテンプレート未同梱
- `Pagination.page_token` / `PageInfo.next_page_token` は proto 定義済みだが、Phase1 実装では未対応（常に空）
