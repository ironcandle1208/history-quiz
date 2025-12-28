package postgres

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// NewPool は Postgres へのコネクションプールを作成する。
// NOTE: 本プロジェクトでは DB への I/O を repository 層に閉じ込めるため、usecase には pool を直接渡さない。
func NewPool(ctx context.Context, databaseURL string) (*pgxpool.Pool, error) {
	if databaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL が未設定です")
	}

	cfg, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("DATABASE_URL の解析に失敗しました: %w", err)
	}

	// 混同しやすい点:
	// デフォルト値のままだとローカル開発で接続が詰まった際に原因特定が難しいため、
	// タイムアウトを明示しておく（運用時に調整可能）。
	cfg.MaxConnLifetime = 30 * time.Minute
	cfg.MaxConnIdleTime = 5 * time.Minute

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("pgxpool の作成に失敗しました: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("DB への接続確認に失敗しました: %w", err)
	}

	return pool, nil
}

