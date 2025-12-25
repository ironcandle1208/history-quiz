-- attempts 関連クエリ（sqlc 用）

-- name: CreateAttempt :one
INSERT INTO attempts (user_id, question_id, selected_choice_id, is_correct)
VALUES ($1, $2, $3, $4)
RETURNING id, user_id, question_id, selected_choice_id, is_correct, answered_at;

-- name: ListMyAttempts :many
SELECT id, question_id, selected_choice_id, is_correct, answered_at
FROM attempts
WHERE user_id = $1
ORDER BY answered_at DESC
LIMIT $2;

