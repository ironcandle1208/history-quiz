package observability

import (
	"context"
	"encoding/json"
	"log"
	"time"
)

const defaultReportInterval = time.Minute

// StartSnapshotReporter は定期的にメトリクススナップショットをログ出力する。
func StartSnapshotReporter(ctx context.Context, logger *log.Logger, collector *Collector, interval time.Duration) {
	if logger == nil || collector == nil {
		return
	}
	if interval <= 0 {
		interval = defaultReportInterval
	}

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			emitSnapshot(logger, collector.Snapshot())
		}
	}
}

// emitSnapshot は CollectorSnapshot を JSON ログへ整形して出力する。
func emitSnapshot(logger *log.Logger, snapshot CollectorSnapshot) {
	if len(snapshot.Methods) == 0 {
		return
	}

	payload := map[string]any{
		"at":      snapshot.CollectedAt.UTC().Format(time.RFC3339Nano),
		"metrics": snapshot.Methods,
		"type":    "grpc_metrics_snapshot",
	}

	encoded, err := json.Marshal(payload)
	if err != nil {
		logger.Printf("observability: failed to marshal grpc metric snapshot: %v", err)
		return
	}
	logger.Printf("%s", encoded)
}
