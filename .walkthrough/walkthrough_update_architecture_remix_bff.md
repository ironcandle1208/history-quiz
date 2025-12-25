# Walkthrough: APIGateway 廃止（Remix に BFF を内包）

## 背景
- クライアントは Web のみ想定となった。
- 運用・デプロイ単位を増やさず、認証/入力整形/バックエンド呼び出しを一箇所に集約したい。

## 変更した方針（結論）
- 別プロセスの `APIGateway` は廃止し、**Remix（SSR サーバー）を BFF として利用**する。
- 構成は以下を前提とする。
  - `Browser → Remix(HTTP) → Go Backend(gRPC) → DB`

## 要件との整合
- もともとの「HTTP/JSON と gRPC で責務分離」という意図は維持する。
  - 外部公開: Browser ↔ Remix は HTTP（レスポンスは JSON/HTML）
  - 内部RPC: Remix ↔ Go Backend は gRPC（Protocol Buffers）
- “Gateway” を独立サービスとして置かないだけで、**Gateway が担う責務（認証・バリデーション・整形・委譲）**は Remix に集約される。

## 更新したドキュメント
- `docs/tech.md`: Remix 採用、2サービス構成（Remix + Go Backend）、認証（Cookie セッション優先）に更新
- `docs/design.md`: コンポーネントを Remix（SSR + BFF）中心に再整理、図とテスト方針を更新
- `docs/structure.md`: `gateway/` を廃止し、`client/` を Remix 構造（`app/`）前提に更新

## 次に決めること（未確定）
- 認証基盤（外部 IdP / BaaS / 自前）と、セッションストアの方式
- gRPC の TypeScript クライアント生成方法（例: `buf` 採用有無）
