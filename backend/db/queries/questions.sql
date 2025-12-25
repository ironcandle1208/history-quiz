-- questions / choices / answer_keys 関連クエリ（sqlc 用）
-- NOTE: 実装は後続タスクで追加していく。まずはクエリ置き場を確定する。

-- name: CreateQuestion :one
INSERT INTO questions (author_user_id, prompt, explanation)
VALUES ($1, $2, $3)
RETURNING id, author_user_id, prompt, explanation, created_at, updated_at;

-- name: ListMyQuestions :many
SELECT id, prompt, updated_at
FROM questions
WHERE author_user_id = $1
ORDER BY updated_at DESC
LIMIT $2;

