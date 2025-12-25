# Walkthrough: 開発方式（ユースケース駆動 + 契約駆動 + テストピラミッド）

## 背景
- 構成が `Remix（SSR+BFF）` と `Go Backend（gRPC）` に分かれているため、層ごとに進めると未接続の作業が増えやすい。
- 境界（Remix ↔ Backend）は `proto` が契約になるため、仕様変更の影響が大きい。

## 決定
- **ユースケース駆動（縦切り）**で進める（1ユースケースを UI→gRPC→DB まで貫いて完成させる）。
- **契約駆動（proto 先行）**で境界を固める（`proto` を単一の真実として先に確定）。
- **テストピラミッド**で品質を担保する（Unit中心 + 主要経路のIntegration + 最小限のE2E）。

## 進め方（手順）
1. 受け入れ条件（要件）を確認し、対象ユースケースを決める
2. `proto` を追加/更新する
3. Go Backend を実装（usecase → repository(sqlc) → gRPC）
4. Remix を実装（routes(loader/action) → services → gRPC client）
5. Unit/Integration を追加し、主要経路のみE2Eで確認する

## 更新したドキュメント
- `docs/design.md`: `Development Approach` を追加
- `docs/tech.md`: `Development Approach` を追加
