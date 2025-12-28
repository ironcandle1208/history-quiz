package postgres

import (
	"context"
	"fmt"

	"github.com/history-quiz/historyquiz/internal/domain/apperror"
	"github.com/history-quiz/historyquiz/internal/repository"
	"github.com/jackc/pgx/v5/pgxpool"
)

// UserRepository は Postgres 実装の users リポジトリ。
type UserRepository struct {
	pool *pgxpool.Pool
}

var _ repository.UserRepository = (*UserRepository)(nil)

// NewUserRepository は UserRepository を生成する。
func NewUserRepository(pool *pgxpool.Pool) *UserRepository {
	return &UserRepository{pool: pool}
}

func (r *UserRepository) EnsureUserExists(ctx context.Context, userID string) error {
	if userID == "" {
		return apperror.InvalidArgument("userId が空です", apperror.FieldViolation{Field: "user_id", Description: "必須です"})
	}

	// userId = OIDC sub を前提にしているため、まず users に存在させる。
	// 混同しやすい点: questions/attempts は users(id) に外部キーがあるため、
	// 先に users を作っておかないと INSERT が失敗する。
	_, err := r.pool.Exec(ctx, `INSERT INTO users (id) VALUES ($1) ON CONFLICT (id) DO NOTHING`, userID)
	if err != nil {
		return apperror.Internal("ユーザーの初期化に失敗しました", fmt.Errorf("insert users: %w", err))
	}
	return nil
}

