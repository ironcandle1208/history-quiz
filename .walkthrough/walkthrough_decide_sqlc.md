# Walkthrough: DBアクセスに `sqlc` を採用

## 背景
- Backend（Go）は gRPC サーバーとしてドメインロジックと永続化を担当する。
- クイズ/作問/履歴といったデータは RDB（PostgreSQL）で整合性を保ちながら扱いたい。
- ORM の抽象化よりも、クエリの意図が明確でレビューしやすい形を優先したい。

## 決定
- Go Backend の DB アクセスは `sqlc` を採用する。
- ドライバは `pgx` を前提にする（詳細は実装フェーズで確定）。

## 採用理由
- 生SQLを単一の真実として管理でき、意図がレビューしやすい。
- 型安全なコード生成により、DBスキーマとアプリのズレをコンパイル時に検出しやすい。
- 複雑クエリ（集計、JOIN等）でも SQL の表現力を落とさず実装できる。

## 置き場所（案）
- `backend/db/queries/`: `sqlc` の入力SQLを配置
- `backend/sqlc.yaml`: `sqlc` 設定ファイル
- `backend/db/migrations/`: マイグレーション（ツールは実装で選定）

## 更新したドキュメント
- `docs/tech.md`: Backend のDBアクセスを `sqlc`（+ `pgx`）に更新
- `docs/structure.md`: `sqlc` 前提のディレクトリ案を追記
- `docs/design.md`: Backend の依存に `sqlc` 生成コードを追記
