package interceptors

import (
	"context"

	"github.com/history-quiz/historyquiz/internal/app/contextkeys"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// UnaryRequireAuthByMethodInterceptor は、FullMethod を見て認証必須/不要を切り替える。
// 混同しやすい点として、Remix 側の「画面アクセス制御」と gRPC 側の「データ保護」は別物なので、
// ここで最終的に守る（BFF を信頼しない）。
func UnaryRequireAuthByMethodInterceptor(allowAnonymousMethods map[string]struct{}) grpc.UnaryServerInterceptor {
	return func(
		ctx context.Context,
		req any,
		info *grpc.UnaryServerInfo,
		handler grpc.UnaryHandler,
	) (any, error) {
		if _, ok := allowAnonymousMethods[info.FullMethod]; ok {
			return handler(ctx, req)
		}

		if userID, ok := contextkeys.UserID(ctx); !ok || userID == "" {
			return nil, status.Error(codes.Unauthenticated, "認証が必要です")
		}

		return handler(ctx, req)
	}
}

