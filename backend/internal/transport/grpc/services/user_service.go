package services

import (
	"context"

	userv1 "github.com/history-quiz/historyquiz/proto/user/v1"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// UserService は UserServiceServer の暫定実装。
// NOTE: DB・ユースケース層の実装後に置き換える。
type UserService struct {
	userv1.UnimplementedUserServiceServer
}

// NewUserService は UserService を生成する。
func NewUserService() *UserService {
	return &UserService{}
}

func (s *UserService) ListMyAttempts(ctx context.Context, req *userv1.ListMyAttemptsRequest) (*userv1.ListMyAttemptsResponse, error) {
	_ = ctx
	_ = req
	return nil, status.Error(codes.Unimplemented, "未実装: ListMyAttempts")
}

func (s *UserService) GetMyStats(ctx context.Context, req *userv1.GetMyStatsRequest) (*userv1.GetMyStatsResponse, error) {
	_ = ctx
	_ = req
	return nil, status.Error(codes.Unimplemented, "未実装: GetMyStats")
}

