package services

import (
	"context"
	"time"

	"github.com/history-quiz/historyquiz/internal/app/contextkeys"
	userusecase "github.com/history-quiz/historyquiz/internal/usecase/user"
	commonv1 "github.com/history-quiz/historyquiz/proto/common/v1"
	userv1 "github.com/history-quiz/historyquiz/proto/user/v1"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// UserService は UserServiceServer 実装。
type UserService struct {
	userv1.UnimplementedUserServiceServer
	usecase *userusecase.Usecase
}

// NewUserService は UserService を生成する。
func NewUserService(usecase *userusecase.Usecase) *UserService {
	return &UserService{usecase: usecase}
}

func (s *UserService) ListMyAttempts(ctx context.Context, req *userv1.ListMyAttemptsRequest) (*userv1.ListMyAttemptsResponse, error) {
	if s.usecase == nil {
		return nil, status.Error(codes.FailedPrecondition, "サーバ初期化が未完了です")
	}

	userID, _ := contextkeys.UserID(ctx)
	attempts, nextToken, err := s.usecase.ListMyAttempts(ctx, userID, req.GetPagination().GetPageSize())
	if err != nil {
		return nil, toStatusError(err)
	}

	resp := &userv1.ListMyAttemptsResponse{
		Context: requestIDForResponse(ctx, req.GetContext()),
		PageInfo: &commonv1.PageInfo{
			NextPageToken: nextToken,
		},
	}
	for _, a := range attempts {
		resp.Attempts = append(resp.Attempts, &userv1.Attempt{
			Id:              a.ID,
			QuestionId:       a.QuestionID,
			QuestionPrompt:   a.QuestionPrompt,
			SelectedChoiceId: a.SelectedChoiceID,
			IsCorrect:        a.IsCorrect,
			AnsweredAt:       a.AnsweredAt.UTC().Format(time.RFC3339Nano),
		})
	}
	return resp, nil
}

func (s *UserService) GetMyStats(ctx context.Context, req *userv1.GetMyStatsRequest) (*userv1.GetMyStatsResponse, error) {
	if s.usecase == nil {
		return nil, status.Error(codes.FailedPrecondition, "サーバ初期化が未完了です")
	}

	userID, _ := contextkeys.UserID(ctx)
	stats, err := s.usecase.GetMyStats(ctx, userID)
	if err != nil {
		return nil, toStatusError(err)
	}

	return &userv1.GetMyStatsResponse{
		Context: requestIDForResponse(ctx, req.GetContext()),
		Stats: &userv1.Stats{
			TotalAttempts:   stats.TotalAttempts,
			CorrectAttempts: stats.CorrectAttempts,
			Accuracy:        stats.Accuracy,
		},
	}, nil
}
