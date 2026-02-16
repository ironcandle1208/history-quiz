package main

import (
	"context"
	"log"
	"net"
	"os"
	"strconv"
	"time"

	"github.com/history-quiz/historyquiz/internal/infrastructure/observability"
	"github.com/history-quiz/historyquiz/internal/infrastructure/postgres"
	grpcserver "github.com/history-quiz/historyquiz/internal/transport/grpc"
	questionusecase "github.com/history-quiz/historyquiz/internal/usecase/question"
	quizusecase "github.com/history-quiz/historyquiz/internal/usecase/quiz"
	userusecase "github.com/history-quiz/historyquiz/internal/usecase/user"
)

// main は gRPC サーバーを起動するエントリポイント。
// NOTE: 本実装は骨格のみで、サービス登録は後続タスク（proto 生成後）で追加する。
func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "50051"
	}

	lis, err := net.Listen("tcp", ":"+port)
	if err != nil {
		log.Fatalf("listen failed: %v", err)
	}

	ctx := context.Background()

	// DB への接続は server 起動の必須要件とする。
	// NOTE: ローカル開発では Supabase/Neon 等の接続文字列を DATABASE_URL に設定する。
	pool, err := postgres.NewPool(ctx, os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Fatalf("db init failed: %v", err)
	}
	defer pool.Close()

	userRepo := postgres.NewUserRepository(pool)
	questionRepo := postgres.NewQuestionRepository(pool)
	attemptRepo := postgres.NewAttemptRepository(pool)

	quizUC := quizusecase.NewUsecase(questionRepo, attemptRepo, userRepo)
	questionUC := questionusecase.NewUsecase(questionRepo, userRepo)
	userUC := userusecase.NewUsecase(attemptRepo)

	collector := observability.NewCollector(512)
	unaryObserver := observability.NewUnaryObserver(log.Default(), collector)
	go observability.StartSnapshotReporter(
		context.Background(),
		log.Default(),
		collector,
		resolveMetricsReportInterval(),
	)

	s := grpcserver.NewServer(grpcserver.Dependencies{
		QuizUsecase:                   quizUC,
		QuestionUsecase:               questionUC,
		UserUsecase:                   userUC,
		ObservabilityUnaryInterceptor: unaryObserver.Interceptor(),
	})

	log.Printf("gRPC server listening on :%s", port)
	if err := s.Serve(lis); err != nil {
		log.Fatalf("serve failed: %v", err)
	}
}

// resolveMetricsReportInterval はメトリクス定期出力間隔を秒単位で解決する。
func resolveMetricsReportInterval() time.Duration {
	const envName = "BACKEND_OBSERVABILITY_REPORT_INTERVAL_SECONDS"
	const defaultSeconds = 60

	raw := os.Getenv(envName)
	if raw == "" {
		return time.Duration(defaultSeconds) * time.Second
	}

	seconds, err := strconv.Atoi(raw)
	if err != nil || seconds <= 0 {
		return time.Duration(defaultSeconds) * time.Second
	}
	return time.Duration(seconds) * time.Second
}
