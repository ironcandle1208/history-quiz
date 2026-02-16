package observability

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"github.com/history-quiz/historyquiz/internal/app/contextkeys"
	"google.golang.org/grpc"
	"google.golang.org/grpc/status"
)

// UnaryObserver は gRPC unary のアクセスログとメトリクス集計を担当する。
type UnaryObserver struct {
	collector *Collector
	logger    *log.Logger
}

// NewUnaryObserver は UnaryObserver を生成する。
func NewUnaryObserver(logger *log.Logger, collector *Collector) *UnaryObserver {
	if logger == nil {
		logger = log.Default()
	}
	if collector == nil {
		collector = NewCollector(defaultMaxLatencySamples)
	}

	return &UnaryObserver{
		collector: collector,
		logger:    logger,
	}
}

// Interceptor は unary RPC の観測ログ出力とメトリクス収集を行う interceptor を返す。
func (o *UnaryObserver) Interceptor() grpc.UnaryServerInterceptor {
	return func(
		ctx context.Context,
		req any,
		info *grpc.UnaryServerInfo,
		handler grpc.UnaryHandler,
	) (any, error) {
		startedAt := time.Now()
		resp, err := handler(ctx, req)
		elapsed := time.Since(startedAt)

		fullMethod := "unknown"
		if info != nil && info.FullMethod != "" {
			fullMethod = info.FullMethod
		}
		grpcCode := status.Code(err)
		latencyMs := float64(elapsed.Microseconds()) / 1000.0

		o.collector.RecordRPC(fullMethod, grpcCode, elapsed)
		o.logAccess(ctx, fullMethod, grpcCode.String(), latencyMs)

		return resp, err
	}
}

// Collector は観測中のメトリクス Collector を返す。
func (o *UnaryObserver) Collector() *Collector {
	if o == nil {
		return nil
	}
	return o.collector
}

// logAccess は構造化アクセスログを 1 行 JSON で出力する。
func (o *UnaryObserver) logAccess(ctx context.Context, method string, status string, latencyMs float64) {
	if o == nil || o.logger == nil {
		return
	}

	requestID, _ := contextkeys.RequestID(ctx)
	userID, _ := contextkeys.UserID(ctx)

	payload := map[string]any{
		"at":        time.Now().UTC().Format(time.RFC3339Nano),
		"type":      "grpc_access",
		"latencyMs": latencyMs,
		"method":    method,
		"requestId": requestID,
		"status":    status,
		"userId":    userID,
	}

	encoded, err := json.Marshal(payload)
	if err != nil {
		o.logger.Printf("observability: failed to marshal grpc access log: %v", err)
		return
	}
	o.logger.Printf("%s", encoded)
}
