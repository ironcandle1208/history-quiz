package user

import (
	"context"

	"github.com/history-quiz/historyquiz/internal/domain"
	"github.com/history-quiz/historyquiz/internal/domain/apperror"
	"github.com/history-quiz/historyquiz/internal/repository"
)

// Usecase はマイページ向け（履歴/統計）のユースケースを提供する。
type Usecase struct {
	attemptRepo repository.AttemptRepository
}

// NewUsecase は UserUsecase を生成する。
func NewUsecase(attemptRepo repository.AttemptRepository) *Usecase {
	return &Usecase{attemptRepo: attemptRepo}
}

// ListMyAttempts は自分の解答履歴を返す。
func (u *Usecase) ListMyAttempts(ctx context.Context, userID string, pageSize int32) ([]domain.Attempt, string, error) {
	if userID == "" {
		return nil, "", apperror.Unauthenticated("認証が必要です")
	}
	limit := normalizePageSize(pageSize)

	attempts, err := u.attemptRepo.ListMyAttempts(ctx, userID, limit)
	if err != nil {
		return nil, "", err
	}
	// Phase1 では page_token を未実装（next_page_token は空）。
	return attempts, "", nil
}

// GetMyStats は自分の統計（正答率など）を返す。
func (u *Usecase) GetMyStats(ctx context.Context, userID string) (domain.Stats, error) {
	if userID == "" {
		return domain.Stats{}, apperror.Unauthenticated("認証が必要です")
	}
	return u.attemptRepo.GetMyStats(ctx, userID)
}

// normalizePageSize は pageSize のデフォルト/上限を統一する。
func normalizePageSize(pageSize int32) int32 {
	if pageSize <= 0 {
		return 20
	}
	if pageSize > 100 {
		return 100
	}
	return pageSize
}

