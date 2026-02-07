# Walkthrough: 論理削除方式（`deleted_at`）の決定

## 結論
- 本プロダクトでは `Question` の削除は **`deleted_at` による論理削除**を採用する。

## 理由
- マイページで「解答履歴」「正答率」を扱うため、過去の `Attempt`（解答履歴）との参照整合性を壊しにくい方式が必要。
- `Question` を物理削除すると、`Attempt.question_id` の参照先が消えるため、履歴表示や集計の一貫性が崩れやすい。
- 復元頻度が低くても、論理削除は運用上の安全弁として有効。

## 方針
- 一覧/出題/編集の通常クエリは `deleted_at IS NULL` を標準とする（`sqlc` のクエリで徹底）。
- 削除済み `Question` は出題対象外とする。
- `Attempt` の削除（物理/論理、保持期間）は別途決める（進捗指標に影響するため）。

## 更新したドキュメント
- `docs/design.md`: `Question.deletedAt` と `Deletion Policy` を追記
- `docs/tech.md`: `Data Lifecycle（削除方針）` と Decision Log を追記
- `docs/structure.md`: `deleted_at` クエリ標準（`deleted_at IS NULL`）を追記

## マイグレーション
- 既にDBが作成済みの場合は `deleted_at` 列追加のマイグレーションが必要。
  - `backend/db/migrations/20251226195500_add_questions_deleted_at.sql`
