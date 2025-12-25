# backend（Go / gRPC）

このディレクトリは Go の gRPC サーバーを配置する。

## 役割
- ドメインロジック（出題、判定、認可、作問CRUD、履歴/統計）を実装する
- DB（PostgreSQL）へ永続化する

## レイヤ方針（概要）
- transport（gRPC）→ usecase → domain → repository(interface) → infrastructure(DB/sqlc)

