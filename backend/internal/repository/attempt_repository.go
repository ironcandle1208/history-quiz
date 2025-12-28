package repository

import (
	"context"

	"github.com/history-quiz/historyquiz/internal/domain"
)

// AttemptRepository は attempts の永続化を抽象化する。
type AttemptRepository interface {
	CreateAttempt(ctx context.Context, userID string, questionID string, selectedChoiceID string, isCorrect bool) (attemptID string, err error)
	ListMyAttempts(ctx context.Context, userID string, limit int32) ([]domain.Attempt, error)
	GetMyStats(ctx context.Context, userID string) (domain.Stats, error)
}

