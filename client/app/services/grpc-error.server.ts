// gRPC → HTTP のエラー変換を共通化する（サーバー専用）。
// docs/tech.md の変換表を単一の真実として適用する。

export type HttpErrorPayload = {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  requestId?: string;
};

// mapGrpcCodeToHttpStatus は gRPC status code を HTTP ステータスへ変換する。
// NOTE: ここはルートごとに分岐させず、共通で使う（運用時の調査容易性のため）。
export function mapGrpcCodeToHttpStatus(code: string): number {
  switch (code) {
    case "INVALID_ARGUMENT":
      return 400;
    case "FAILED_PRECONDITION":
      return 409;
    case "OUT_OF_RANGE":
      return 400;
    case "NOT_FOUND":
      return 404;
    case "ALREADY_EXISTS":
      return 409;
    case "PERMISSION_DENIED":
      return 403;
    case "UNAUTHENTICATED":
      return 401;
    case "RESOURCE_EXHAUSTED":
      return 429;
    case "ABORTED":
      return 409;
    case "DEADLINE_EXCEEDED":
      return 504;
    case "UNAVAILABLE":
      return 503;
    case "UNIMPLEMENTED":
      return 501;
    case "INTERNAL":
    case "UNKNOWN":
    case "DATA_LOSS":
      return 500;
    default:
      return 500;
  }
}

