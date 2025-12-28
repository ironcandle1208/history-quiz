package postgres

import (
	"context"
	"fmt"
	"time"

	"github.com/history-quiz/historyquiz/internal/domain"
	"github.com/history-quiz/historyquiz/internal/domain/apperror"
	"github.com/history-quiz/historyquiz/internal/repository"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// AttemptRepository は Postgres 実装の attempts リポジトリ。
type AttemptRepository struct {
	pool *pgxpool.Pool
}

var _ repository.AttemptRepository = (*AttemptRepository)(nil)

// NewAttemptRepository は AttemptRepository を生成する。
func NewAttemptRepository(pool *pgxpool.Pool) *AttemptRepository {
	return &AttemptRepository{pool: pool}
}

func (r *AttemptRepository) CreateAttempt(ctx context.Context, userID string, questionID string, selectedChoiceID string, isCorrect bool) (string, error) {
	if userID == "" {
		return "", apperror.InvalidArgument("userId が空です", apperror.FieldViolation{Field: "user_id", Description: "必須です"})
	}
	if questionID == "" {
		return "", apperror.InvalidArgument("question_id が空です", apperror.FieldViolation{Field: "question_id", Description: "必須です"})
	}
	if selectedChoiceID == "" {
		return "", apperror.InvalidArgument("selected_choice_id が空です", apperror.FieldViolation{Field: "selected_choice_id", Description: "必須です"})
	}

	var attemptID string
	err := r.pool.QueryRow(
		ctx,
		`INSERT INTO attempts (user_id, question_id, selected_choice_id, is_correct)
		 VALUES ($1, $2::uuid, $3::uuid, $4)
		 RETURNING id::text`,
		userID,
		questionID,
		selectedChoiceID,
		isCorrect,
	).Scan(&attemptID)
	if err != nil {
		// 主に uuid のパース失敗や FK 制約違反があり得るため、入力不正として扱う。
		return "", apperror.InvalidArgument("解答履歴の保存に失敗しました（入力が不正です）")
	}
	return attemptID, nil
}

func (r *AttemptRepository) ListMyAttempts(ctx context.Context, userID string, limit int32) ([]domain.Attempt, error) {
	if userID == "" {
		return nil, apperror.Unauthenticated("認証が必要です")
	}

	rows, err := r.pool.Query(
		ctx,
		`SELECT
		   a.id::text,
		   a.question_id::text,
		   q.prompt,
		   a.selected_choice_id::text,
		   a.is_correct,
		   a.answered_at
		 FROM attempts a
		 JOIN questions q ON q.id = a.question_id
		 WHERE a.user_id = $1
		 ORDER BY a.answered_at DESC
		 LIMIT $2`,
		userID,
		limit,
	)
	if err != nil {
		return nil, apperror.Internal("解答履歴の取得に失敗しました", fmt.Errorf("select attempts: %w", err))
	}
	defer rows.Close()

	attempts := make([]domain.Attempt, 0, limit)
	for rows.Next() {
		var a domain.Attempt
		var answeredAt time.Time
		if err := rows.Scan(&a.ID, &a.QuestionID, &a.QuestionPrompt, &a.SelectedChoiceID, &a.IsCorrect, &answeredAt); err != nil {
			return nil, apperror.Internal("解答履歴の読み取りに失敗しました", fmt.Errorf("scan attempts: %w", err))
		}
		a.AnsweredAt = answeredAt
		attempts = append(attempts, a)
	}
	if err := rows.Err(); err != nil {
		return nil, apperror.Internal("解答履歴の取得に失敗しました", fmt.Errorf("attempt rows: %w", err))
	}

	return attempts, nil
}

func (r *AttemptRepository) GetMyStats(ctx context.Context, userID string) (domain.Stats, error) {
	if userID == "" {
		return domain.Stats{}, apperror.Unauthenticated("認証が必要です")
	}

	var total int64
	var correct int64
	err := r.pool.QueryRow(
		ctx,
		`SELECT
		   COUNT(*)::bigint AS total_attempts,
		   COALESCE(SUM(CASE WHEN is_correct THEN 1 ELSE 0 END), 0)::bigint AS correct_attempts
		 FROM attempts
		 WHERE user_id = $1`,
		userID,
	).Scan(&total, &correct)
	if err != nil && err != pgx.ErrNoRows {
		return domain.Stats{}, apperror.Internal("統計の取得に失敗しました", fmt.Errorf("select stats: %w", err))
	}

	accuracy := 0.0
	if total > 0 {
		accuracy = float64(correct) / float64(total)
	}

	return domain.Stats{
		TotalAttempts:   total,
		CorrectAttempts: correct,
		Accuracy:        accuracy,
	}, nil
}

