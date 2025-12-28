package services

import (
	"context"
	"errors"

	"github.com/history-quiz/historyquiz/internal/app/contextkeys"
	"github.com/history-quiz/historyquiz/internal/domain/apperror"
	quizusecase "github.com/history-quiz/historyquiz/internal/usecase/quiz"
	commonv1 "github.com/history-quiz/historyquiz/proto/common/v1"
	quizv1 "github.com/history-quiz/historyquiz/proto/quiz/v1"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// QuizService は QuizServiceServer 実装。
type QuizService struct {
	quizv1.UnimplementedQuizServiceServer
	usecase *quizusecase.Usecase
}

// NewQuizService は QuizService を生成する。
func NewQuizService(usecase *quizusecase.Usecase) *QuizService {
	return &QuizService{usecase: usecase}
}

func (s *QuizService) GetQuestion(ctx context.Context, req *quizv1.GetQuestionRequest) (*quizv1.GetQuestionResponse, error) {
	if s.usecase == nil {
		return nil, status.Error(codes.FailedPrecondition, "サーバ初期化が未完了です")
	}

	requestID := requestIDForResponse(ctx, req.GetContext())
	q, err := s.usecase.GetQuestion(ctx, requestID.GetRequestId(), req.GetPreviousQuestionId())
	if err != nil {
		return nil, toStatusError(err)
	}

	resp := &quizv1.GetQuestionResponse{
		Context: requestID,
		Question: &quizv1.Question{
			Id:          q.ID,
			Prompt:      q.Prompt,
			Explanation: q.Explanation,
		},
	}
	for _, c := range q.Choices {
		resp.Question.Choices = append(resp.Question.Choices, &quizv1.Choice{
			Id:      c.ID,
			Label:   c.Label,
			Ordinal: c.Ordinal,
		})
	}
	return resp, nil
}

func (s *QuizService) SubmitAnswer(ctx context.Context, req *quizv1.SubmitAnswerRequest) (*quizv1.SubmitAnswerResponse, error) {
	if s.usecase == nil {
		return nil, status.Error(codes.FailedPrecondition, "サーバ初期化が未完了です")
	}

	userID, _ := contextkeys.UserID(ctx) // 未ログインの場合は空でよい（履歴は保存しない）

	result, err := s.usecase.SubmitAnswer(ctx, userID, req.GetQuestionId(), req.GetSelectedChoiceId())
	if err != nil {
		return nil, toStatusError(err)
	}

	return &quizv1.SubmitAnswerResponse{
		Context:         requestIDForResponse(ctx, req.GetContext()),
		IsCorrect:       result.IsCorrect,
		CorrectChoiceId: result.CorrectChoiceID,
		AttemptId:       result.AttemptID,
	}, nil
}

// requestIDForResponse は response に載せる request_id を決定する。
// 混同しやすい点: request_id は「追跡用」なので、message 側より metadata→context を優先する。
func requestIDForResponse(ctx context.Context, reqCtx *commonv1.RequestContext) *commonv1.RequestContext {
	if requestID, ok := contextkeys.RequestID(ctx); ok {
		return &commonv1.RequestContext{RequestId: requestID}
	}
	if reqCtx != nil && reqCtx.GetRequestId() != "" {
		return &commonv1.RequestContext{RequestId: reqCtx.GetRequestId()}
	}
	return &commonv1.RequestContext{}
}

// toStatusError は usecase のエラーを gRPC status に変換する。
func toStatusError(err error) error {
	var appErr *apperror.Error
	if errors.As(err, &appErr) {
		switch appErr.Code {
		case apperror.CodeInvalidArgument:
			return status.Error(codes.InvalidArgument, appErr.Message)
		case apperror.CodeNotFound:
			return status.Error(codes.NotFound, appErr.Message)
		case apperror.CodePermissionDenied:
			return status.Error(codes.PermissionDenied, appErr.Message)
		case apperror.CodeUnauthenticated:
			return status.Error(codes.Unauthenticated, appErr.Message)
		default:
			return status.Error(codes.Internal, appErr.Message)
		}
	}
	return status.Error(codes.Internal, "内部エラー")
}
