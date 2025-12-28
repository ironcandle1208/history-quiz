package services

import (
	"context"
	"time"

	"github.com/history-quiz/historyquiz/internal/app/contextkeys"
	"github.com/history-quiz/historyquiz/internal/domain"
	questionusecase "github.com/history-quiz/historyquiz/internal/usecase/question"
	commonv1 "github.com/history-quiz/historyquiz/proto/common/v1"
	questionv1 "github.com/history-quiz/historyquiz/proto/question/v1"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// QuestionService は QuestionServiceServer 実装。
type QuestionService struct {
	questionv1.UnimplementedQuestionServiceServer
	usecase *questionusecase.Usecase
}

// NewQuestionService は QuestionService を生成する。
func NewQuestionService(usecase *questionusecase.Usecase) *QuestionService {
	return &QuestionService{usecase: usecase}
}

func (s *QuestionService) CreateQuestion(ctx context.Context, req *questionv1.CreateQuestionRequest) (*questionv1.CreateQuestionResponse, error) {
	if s.usecase == nil {
		return nil, status.Error(codes.FailedPrecondition, "サーバ初期化が未完了です")
	}

	userID, _ := contextkeys.UserID(ctx)
	draft := domain.QuestionDraft{
		Prompt:         req.GetDraft().GetPrompt(),
		Choices:        req.GetDraft().GetChoices(),
		CorrectOrdinal: req.GetDraft().GetCorrectOrdinal(),
		Explanation:    req.GetDraft().GetExplanation(),
	}

	created, err := s.usecase.CreateQuestion(ctx, userID, draft)
	if err != nil {
		return nil, toStatusError(err)
	}

	return &questionv1.CreateQuestionResponse{
		Context:  requestIDForResponse(ctx, req.GetContext()),
		Question: toQuestionDetail(created),
	}, nil
}

func (s *QuestionService) UpdateQuestion(ctx context.Context, req *questionv1.UpdateQuestionRequest) (*questionv1.UpdateQuestionResponse, error) {
	if s.usecase == nil {
		return nil, status.Error(codes.FailedPrecondition, "サーバ初期化が未完了です")
	}

	userID, _ := contextkeys.UserID(ctx)
	draft := domain.QuestionDraft{
		Prompt:         req.GetDraft().GetPrompt(),
		Choices:        req.GetDraft().GetChoices(),
		CorrectOrdinal: req.GetDraft().GetCorrectOrdinal(),
		Explanation:    req.GetDraft().GetExplanation(),
	}

	updated, err := s.usecase.UpdateQuestion(ctx, userID, req.GetQuestionId(), draft)
	if err != nil {
		return nil, toStatusError(err)
	}

	return &questionv1.UpdateQuestionResponse{
		Context:  requestIDForResponse(ctx, req.GetContext()),
		Question: toQuestionDetail(updated),
	}, nil
}

func (s *QuestionService) GetMyQuestion(ctx context.Context, req *questionv1.GetMyQuestionRequest) (*questionv1.GetMyQuestionResponse, error) {
	if s.usecase == nil {
		return nil, status.Error(codes.FailedPrecondition, "サーバ初期化が未完了です")
	}

	userID, _ := contextkeys.UserID(ctx)
	q, err := s.usecase.GetMyQuestion(ctx, userID, req.GetQuestionId())
	if err != nil {
		return nil, toStatusError(err)
	}

	return &questionv1.GetMyQuestionResponse{
		Context:  requestIDForResponse(ctx, req.GetContext()),
		Question: toQuestionDetail(q),
	}, nil
}

func (s *QuestionService) ListMyQuestions(ctx context.Context, req *questionv1.ListMyQuestionsRequest) (*questionv1.ListMyQuestionsResponse, error) {
	if s.usecase == nil {
		return nil, status.Error(codes.FailedPrecondition, "サーバ初期化が未完了です")
	}

	userID, _ := contextkeys.UserID(ctx)
	questions, nextToken, err := s.usecase.ListMyQuestions(ctx, userID, req.GetPagination().GetPageSize())
	if err != nil {
		return nil, toStatusError(err)
	}

	resp := &questionv1.ListMyQuestionsResponse{
		Context: requestIDForResponse(ctx, req.GetContext()),
		PageInfo: &commonv1.PageInfo{
			NextPageToken: nextToken,
		},
	}
	for _, q := range questions {
		resp.Questions = append(resp.Questions, &questionv1.QuestionSummary{
			Id:        q.ID,
			Prompt:    q.Prompt,
			UpdatedAt: q.UpdatedAt.UTC().Format(time.RFC3339Nano),
		})
	}
	return resp, nil
}

// toQuestionDetail はドメインモデルを proto の QuestionDetail に変換する。
func toQuestionDetail(q domain.QuestionDetail) *questionv1.QuestionDetail {
	d := &questionv1.QuestionDetail{
		Id:              q.ID,
		Prompt:           q.Prompt,
		CorrectChoiceId:  q.CorrectChoiceID,
		Explanation:      q.Explanation,
		UpdatedAt:        q.UpdatedAt.UTC().Format(time.RFC3339Nano),
	}
	for _, c := range q.Choices {
		d.Choices = append(d.Choices, &questionv1.Choice{
			Id:      c.ID,
			Label:   c.Label,
			Ordinal: c.Ordinal,
		})
	}
	return d
}
