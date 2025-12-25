package services

import (
	"context"

	questionv1 "github.com/history-quiz/historyquiz/proto/question/v1"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// QuestionService は QuestionServiceServer の暫定実装。
// NOTE: DB・ユースケース層の実装後に置き換える。
type QuestionService struct {
	questionv1.UnimplementedQuestionServiceServer
}

// NewQuestionService は QuestionService を生成する。
func NewQuestionService() *QuestionService {
	return &QuestionService{}
}

func (s *QuestionService) CreateQuestion(ctx context.Context, req *questionv1.CreateQuestionRequest) (*questionv1.CreateQuestionResponse, error) {
	_ = ctx
	_ = req
	return nil, status.Error(codes.Unimplemented, "未実装: CreateQuestion")
}

func (s *QuestionService) UpdateQuestion(ctx context.Context, req *questionv1.UpdateQuestionRequest) (*questionv1.UpdateQuestionResponse, error) {
	_ = ctx
	_ = req
	return nil, status.Error(codes.Unimplemented, "未実装: UpdateQuestion")
}

func (s *QuestionService) GetMyQuestion(ctx context.Context, req *questionv1.GetMyQuestionRequest) (*questionv1.GetMyQuestionResponse, error) {
	_ = ctx
	_ = req
	return nil, status.Error(codes.Unimplemented, "未実装: GetMyQuestion")
}

func (s *QuestionService) ListMyQuestions(ctx context.Context, req *questionv1.ListMyQuestionsRequest) (*questionv1.ListMyQuestionsResponse, error) {
	_ = ctx
	_ = req
	return nil, status.Error(codes.Unimplemented, "未実装: ListMyQuestions")
}

