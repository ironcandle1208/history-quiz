package apperror

import "errors"

// Code はアプリケーション層で扱うエラー種別。
// transport 層（gRPC/HTTP）では、この Code を status code に変換する。
type Code string

const (
	// CodeInvalidArgument は入力不正（必須欠落/範囲外/整合性違反）を表す。
	CodeInvalidArgument Code = "INVALID_ARGUMENT"
	// CodeNotFound はリソースが存在しない（または論理削除済み）ことを表す。
	CodeNotFound Code = "NOT_FOUND"
	// CodePermissionDenied は所有者チェック等の認可違反を表す。
	CodePermissionDenied Code = "PERMISSION_DENIED"
	// CodeUnauthenticated は未認証を表す。
	CodeUnauthenticated Code = "UNAUTHENTICATED"
	// CodeInternal は想定外のサーバ内部エラーを表す。
	CodeInternal Code = "INTERNAL"
)

// FieldViolation は入力エラーのフィールド単位の詳細。
// 将来的に gRPC の details や HTTP の errors.details に載せるための構造。
type FieldViolation struct {
	Field       string
	Description string
}

// Error はアプリ内で共通化するエラー表現。
// 混同しやすい点: DB/外部依存のエラーをそのまま境界へ漏らすと、表示・ログ・監視が崩れやすい。
// ここで「意味のあるコード」に寄せてから transport で status に変換する。
type Error struct {
	Code           Code
	Message        string
	FieldViolations []FieldViolation
	Cause          error
}

func (e *Error) Error() string {
	if e == nil {
		return ""
	}
	return e.Message
}

func (e *Error) Unwrap() error { return e.Cause }

// New は Code/Message を指定して Error を作る。
func New(code Code, message string) *Error {
	return &Error{Code: code, Message: message}
}

// WithCause は原因エラーを保持した Error を返す。
func WithCause(code Code, message string, cause error) *Error {
	return &Error{Code: code, Message: message, Cause: cause}
}

// InvalidArgument は入力不正を表す Error を作る。
// fieldViolations は「どのフィールドがなぜ不正か」を UI に返す用途。
func InvalidArgument(message string, fieldViolations ...FieldViolation) *Error {
	return &Error{Code: CodeInvalidArgument, Message: message, FieldViolations: fieldViolations}
}

// NotFound は NotFound を表す Error を作る。
func NotFound(message string) *Error {
	return &Error{Code: CodeNotFound, Message: message}
}

// PermissionDenied は認可違反を表す Error を作る。
func PermissionDenied(message string) *Error {
	return &Error{Code: CodePermissionDenied, Message: message}
}

// Unauthenticated は未認証を表す Error を作る。
func Unauthenticated(message string) *Error {
	return &Error{Code: CodeUnauthenticated, Message: message}
}

// Internal は内部エラーを表す Error を作る（原因を保持）。
func Internal(message string, cause error) *Error {
	return &Error{Code: CodeInternal, Message: message, Cause: cause}
}

// IsCode は err が指定の Code を持つ Error かどうかを判定する。
func IsCode(err error, code Code) bool {
	var appErr *Error
	if !errors.As(err, &appErr) {
		return false
	}
	return appErr.Code == code
}

