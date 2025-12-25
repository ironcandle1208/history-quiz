// gRPC クライアント（サーバー専用）。
// NOTE: @grpc/grpc-js はブラウザでは動かないため、routes の loader/action からのみ利用する。

export type GrpcMetadata = {
  userId: string;
  requestId: string;
};

// createRequestId は相関IDを生成する。
// 後でログ/エラー調査のために、HTTPレスポンスにも含める想定。
export function createRequestId(): string {
  // TODO: 安定したID生成（例: crypto.randomUUID）を利用する
  return "TODO-request-id";
}

// buildGrpcMetadata は userId/requestId を gRPC metadata に載せるための情報を作る。
export function buildGrpcMetadata(params: { userId: string; requestId: string }): GrpcMetadata {
  return { userId: params.userId, requestId: params.requestId };
}

