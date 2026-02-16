package grpcserver

import (
	"github.com/history-quiz/historyquiz/internal/transport/grpc/interceptors"
	"github.com/history-quiz/historyquiz/internal/transport/grpc/services"
	questionusecase "github.com/history-quiz/historyquiz/internal/usecase/question"
	quizusecase "github.com/history-quiz/historyquiz/internal/usecase/quiz"
	userusecase "github.com/history-quiz/historyquiz/internal/usecase/user"
	questionv1 "github.com/history-quiz/historyquiz/proto/question/v1"
	quizv1 "github.com/history-quiz/historyquiz/proto/quiz/v1"
	userv1 "github.com/history-quiz/historyquiz/proto/user/v1"
	"google.golang.org/grpc"
)

// Dependencies は gRPC transport が必要とする依存（ユースケース）をまとめたもの。
type Dependencies struct {
	QuizUsecase                   *quizusecase.Usecase
	QuestionUsecase               *questionusecase.Usecase
	UserUsecase                   *userusecase.Usecase
	ObservabilityUnaryInterceptor grpc.UnaryServerInterceptor
}

// NewServer は gRPC サーバーを生成する。
// 初期段階では「context 注入（requestId/userId）」を共通化し、後続でサービス登録を追加する。
func NewServer(deps Dependencies) *grpc.Server {
	allowAnonymous := map[string]struct{}{
		// クイズは未ログインでも遊べる前提（要件9ではマイページ/作問のみログイン必須）。
		"/historyquiz.quiz.v1.QuizService/GetQuestion":  {},
		"/historyquiz.quiz.v1.QuizService/SubmitAnswer": {},
	}

	unaryInterceptors := []grpc.UnaryServerInterceptor{
		interceptors.UnaryContextInterceptor(false),
	}
	if deps.ObservabilityUnaryInterceptor != nil {
		unaryInterceptors = append(unaryInterceptors, deps.ObservabilityUnaryInterceptor)
	}
	// 順序が重要:
	// 1) metadata から requestId/userId を context へ注入
	// 2) 観測 interceptor で認証失敗を含む全 RPC を計測
	// 3) 認証必須メソッドを最終的に遮断
	unaryInterceptors = append(unaryInterceptors, interceptors.UnaryRequireAuthByMethodInterceptor(allowAnonymous))

	s := grpc.NewServer(grpc.ChainUnaryInterceptor(unaryInterceptors...))

	quizv1.RegisterQuizServiceServer(s, services.NewQuizService(deps.QuizUsecase))
	questionv1.RegisterQuestionServiceServer(s, services.NewQuestionService(deps.QuestionUsecase))
	userv1.RegisterUserServiceServer(s, services.NewUserService(deps.UserUsecase))

	return s
}
