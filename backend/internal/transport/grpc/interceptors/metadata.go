package interceptors

import (
	"context"

	"github.com/history-quiz/historyquiz/internal/app/contextkeys"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

const (
	// metadataKeyUserID は Remix→Backend で userId を伝播するためのキー。
	// NOTE: Phase1 では userId = OIDC sub を想定（docs/Phase1/decisions.md）。
	metadataKeyUserID = "x-user-id"

	// metadataKeyRequestID は相関ID（トレース用）を伝播するためのキー。
	metadataKeyRequestID = "x-request-id"
)

// UnaryContextInterceptor は metadata から userId/requestId を取り出し、context に格納する。
// 認証必須のRPCでは、userId が無い場合に UNAUTHENTICATED を返す。
func UnaryContextInterceptor(requireAuth bool) grpc.UnaryServerInterceptor {
	return func(
		ctx context.Context,
		req any,
		info *grpc.UnaryServerInfo,
		handler grpc.UnaryHandler,
	) (any, error) {
		md, _ := metadata.FromIncomingContext(ctx)

		if requestID := first(md.Get(metadataKeyRequestID)); requestID != "" {
			ctx = contextkeys.WithRequestID(ctx, requestID)
		}

		userID := first(md.Get(metadataKeyUserID))
		if userID != "" {
			ctx = contextkeys.WithUserID(ctx, userID)
		}

		// 混同しやすい点:
		// proto の message に user_id を持たせても、バックエンドは信頼してはいけない（なりすまし可能）。
		// 最終的な userId は、metadata から取り出した値を context に入れたものを使う。
		if requireAuth && userID == "" {
			return nil, status.Error(codes.Unauthenticated, "認証が必要です")
		}

		return handler(ctx, req)
	}
}

func first(values []string) string {
	if len(values) == 0 {
		return ""
	}
	return values[0]
}

