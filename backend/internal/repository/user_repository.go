package repository

import "context"

// UserRepository は users の永続化を抽象化する。
type UserRepository interface {
	EnsureUserExists(ctx context.Context, userID string) error
}

