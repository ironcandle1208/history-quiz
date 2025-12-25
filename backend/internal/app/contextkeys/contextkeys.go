package contextkeys

import "context"

// contextKey は context に値を入れるための専用キー。
// 文字列キーをそのまま使うと衝突しやすいため、独自型で安全に扱う。
type contextKey string

const (
	requestIDKey contextKey = "request_id"
	userIDKey    contextKey = "user_id"
)

// WithRequestID は context に requestId を格納する。
func WithRequestID(ctx context.Context, requestID string) context.Context {
	return context.WithValue(ctx, requestIDKey, requestID)
}

// RequestID は context から requestId を取得する。
func RequestID(ctx context.Context) (string, bool) {
	v, ok := ctx.Value(requestIDKey).(string)
	return v, ok && v != ""
}

// WithUserID は context に userId を格納する。
func WithUserID(ctx context.Context, userID string) context.Context {
	return context.WithValue(ctx, userIDKey, userID)
}

// UserID は context から userId を取得する。
func UserID(ctx context.Context) (string, bool) {
	v, ok := ctx.Value(userIDKey).(string)
	return v, ok && v != ""
}

