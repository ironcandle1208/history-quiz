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
	QuizUsecase     *quizusecase.Usecase
	QuestionUsecase *questionusecase.Usecase
	UserUsecase     *userusecase.Usecase
}

// NewServer は gRPC サーバーを生成する。
// 初期段階では「context 注入（requestId/userId）」を共通化し、後続でサービス登録を追加する。
func NewServer(deps Dependencies) *grpc.Server {
	allowAnonymous := map[string]struct{}{
		// クイズは未ログインでも遊べる前提（要件9ではマイページ/作問のみログイン必須）。
		"/historyquiz.quiz.v1.QuizService/GetQuestion":  {},
		"/historyquiz.quiz.v1.QuizService/SubmitAnswer": {},
	}

	s := grpc.NewServer(
		grpc.ChainUnaryInterceptor(
			interceptors.UnaryContextInterceptor(false),
			interceptors.UnaryRequireAuthByMethodInterceptor(allowAnonymous),
		),
	)

	quizv1.RegisterQuizServiceServer(s, services.NewQuizService(deps.QuizUsecase))
	questionv1.RegisterQuestionServiceServer(s, services.NewQuestionService(deps.QuestionUsecase))
	userv1.RegisterUserServiceServer(s, services.NewUserService(deps.UserUsecase))

	return s
}
