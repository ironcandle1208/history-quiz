package postgres

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// withTx はトランザクションの begin/commit/rollback を共通化する。
// 混同しやすい点: 途中で error が返った場合は必ず rollback してから上位に返す。
func withTx(ctx context.Context, pool *pgxpool.Pool, fn func(tx pgx.Tx) error) error {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("トランザクション開始に失敗しました: %w", err)
	}
	defer tx.Rollback(ctx) // commit 成功時は no-op

	if err := fn(tx); err != nil {
		return err
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("トランザクションの commit に失敗しました: %w", err)
	}
	return nil
}

