package main

import (
	"context"
	"log"
	"net"
	"os"

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

	s := grpcserver.NewServer(grpcserver.Dependencies{
		QuizUsecase:     quizUC,
		QuestionUsecase: questionUC,
		UserUsecase:     userUC,
	})

	log.Printf("gRPC server listening on :%s", port)
	if err := s.Serve(lis); err != nil {
		log.Fatalf("serve failed: %v", err)
	}
}
