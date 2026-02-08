// gRPC クライアント（サーバー専用）。
// Remix の loader/action からのみ利用し、ブラウザバンドルへ混入しないようにする。

import { existsSync } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
import path from "node:path";

import {
  credentials,
  loadPackageDefinition,
  Metadata,
  type ChannelCredentials,
  type ServiceClientConstructor,
  type ServiceError,
} from "@grpc/grpc-js";
import { loadSync } from "@grpc/proto-loader";

const ENV_BACKEND_GRPC_ADDRESS = "BACKEND_GRPC_ADDRESS";
const ENV_BACKEND_GRPC_TIMEOUT_MS = "BACKEND_GRPC_TIMEOUT_MS";
const ENV_BACKEND_GRPC_TLS = "BACKEND_GRPC_TLS";
const ENV_GRPC_PROTO_ROOT = "GRPC_PROTO_ROOT";

const DEFAULT_BACKEND_GRPC_ADDRESS = "127.0.0.1:50051";
const DEFAULT_BACKEND_GRPC_TIMEOUT_MS = 3_000;

const METADATA_KEY_USER_ID = "x-user-id";
const METADATA_KEY_REQUEST_ID = "x-request-id";

const REQUIRED_PROTO_RELATIVE_PATHS = [
  "historyquiz/quiz/v1/quiz_service.proto",
  "historyquiz/question/v1/question_service.proto",
  "historyquiz/user/v1/user_service.proto",
] as const;

export type RequestContext = {
  requestId?: string;
};

export type RequestWithContext = {
  context?: RequestContext;
};

export type GrpcCallContext = {
  requestId?: string;
  timeoutMs?: number;
  userId?: string;
};

export type GrpcCallResult<TResponse> = {
  requestId: string;
  response: TResponse;
};

// GrpcCallError は gRPC 失敗時に requestId を保持して上位へ伝搬する。
export class GrpcCallError extends Error {
  public readonly grpcError: unknown;
  public readonly requestId: string;

  constructor(params: { grpcError: unknown; requestId: string }) {
    super("gRPC 呼び出しに失敗しました。");
    this.name = "GrpcCallError";
    this.grpcError = params.grpcError;
    this.requestId = params.requestId;
  }
}

export type GrpcMetadata = {
  requestId: string;
  userId?: string;
};

type UnaryMethod<TRequest, TResponse> = (
  request: TRequest,
  metadata: Metadata,
  options: { deadline: Date },
  callback: (error: ServiceError | null, response: TResponse) => void,
) => void;

type QuizRawClient = {
  getQuestion: UnaryMethod<unknown, unknown>;
  submitAnswer: UnaryMethod<unknown, unknown>;
};

type QuestionRawClient = {
  createQuestion: UnaryMethod<unknown, unknown>;
  getMyQuestion: UnaryMethod<unknown, unknown>;
  listMyQuestions: UnaryMethod<unknown, unknown>;
  updateQuestion: UnaryMethod<unknown, unknown>;
};

type UserRawClient = {
  getMyStats: UnaryMethod<unknown, unknown>;
  listMyAttempts: UnaryMethod<unknown, unknown>;
};

type GrpcClients = {
  question: QuestionRawClient;
  quiz: QuizRawClient;
  user: UserRawClient;
};

type LoadedGrpcPackage = {
  historyquiz?: {
    question?: { v1?: { QuestionService?: ServiceClientConstructor } };
    quiz?: { v1?: { QuizService?: ServiceClientConstructor } };
    user?: { v1?: { UserService?: ServiceClientConstructor } };
  };
};

let cachedClients: GrpcClients | null = null;

// isGrpcCallError は unknown が GrpcCallError かどうかを判定する。
export function isGrpcCallError(error: unknown): error is GrpcCallError {
  return error instanceof GrpcCallError;
}

// assertServerOnly は Node.js 実行時以外で呼ばれた場合に例外を投げる。
function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("gRPC クライアントはサーバー側（loader/action）専用です。");
  }
}

// resolveGrpcAddress は gRPC 接続先アドレスを環境変数から解決する。
function resolveGrpcAddress(): string {
  const fromEnv = process.env[ENV_BACKEND_GRPC_ADDRESS];
  if (typeof fromEnv === "string" && fromEnv.trim().length > 0) {
    return fromEnv.trim();
  }

  return DEFAULT_BACKEND_GRPC_ADDRESS;
}

// resolveGrpcTimeoutMs は gRPC のデフォルトタイムアウトを解決する。
function resolveGrpcTimeoutMs(): number {
  const fromEnv = process.env[ENV_BACKEND_GRPC_TIMEOUT_MS];
  if (!fromEnv) {
    return DEFAULT_BACKEND_GRPC_TIMEOUT_MS;
  }

  const parsed = Number.parseInt(fromEnv, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return DEFAULT_BACKEND_GRPC_TIMEOUT_MS;
  }

  return parsed;
}

// createChannelCredentials は TLS 設定に応じて gRPC の資格情報を作成する。
function createChannelCredentials(): ChannelCredentials {
  if (process.env[ENV_BACKEND_GRPC_TLS] === "true") {
    return credentials.createSsl();
  }

  return credentials.createInsecure();
}

// resolveProtoRoot は proto ルートディレクトリを解決する。
function resolveProtoRoot(): string {
  const candidateRoots = [
    process.env[ENV_GRPC_PROTO_ROOT] ?? "",
    path.resolve(process.cwd(), "../proto"),
    path.resolve(process.cwd(), "proto"),
  ]
    .map((value) => value.trim())
    .filter((value, index, values) => value.length > 0 && values.indexOf(value) === index);

  for (const root of candidateRoots) {
    const hasAllRequiredFiles = REQUIRED_PROTO_RELATIVE_PATHS.every((relativePath) =>
      existsSync(path.join(root, relativePath)),
    );
    if (hasAllRequiredFiles) {
      return root;
    }
  }

  throw new Error(
    `proto ルートを解決できません。${ENV_GRPC_PROTO_ROOT} を設定するか、${REQUIRED_PROTO_RELATIVE_PATHS.join(", ")} が存在する場所で起動してください。`,
  );
}

// loadGrpcPackage は .proto を読み込んで動的 gRPC パッケージを返す。
function loadGrpcPackage(): LoadedGrpcPackage {
  const protoRoot = resolveProtoRoot();
  const protoFiles = REQUIRED_PROTO_RELATIVE_PATHS.map((relativePath) => path.join(protoRoot, relativePath));
  const definition = loadSync(protoFiles, {
    defaults: true,
    enums: String,
    includeDirs: [protoRoot],
    keepCase: false,
    longs: String,
    oneofs: true,
  });

  return loadPackageDefinition(definition) as unknown as LoadedGrpcPackage;
}

// requireServiceConstructor は proto ロード結果から必須サービス定義を取り出す。
function requireServiceConstructor(
  constructor: ServiceClientConstructor | undefined,
  name: string,
): ServiceClientConstructor {
  if (!constructor) {
    throw new Error(`gRPC サービス定義の解決に失敗しました: ${name}`);
  }
  return constructor;
}

// createGrpcClients は gRPC クライアント群を初期化する。
function createGrpcClients(): GrpcClients {
  const loaded = loadGrpcPackage();
  const address = resolveGrpcAddress();
  const channelCredentials = createChannelCredentials();

  const QuizService = requireServiceConstructor(loaded.historyquiz?.quiz?.v1?.QuizService, "QuizService");
  const QuestionService = requireServiceConstructor(
    loaded.historyquiz?.question?.v1?.QuestionService,
    "QuestionService",
  );
  const UserService = requireServiceConstructor(loaded.historyquiz?.user?.v1?.UserService, "UserService");

  return {
    question: new QuestionService(address, channelCredentials) as unknown as QuestionRawClient,
    quiz: new QuizService(address, channelCredentials) as unknown as QuizRawClient,
    user: new UserService(address, channelCredentials) as unknown as UserRawClient,
  };
}

// getGrpcClients はシングルトンの gRPC クライアント群を返す。
function getGrpcClients(): GrpcClients {
  assertServerOnly();
  if (!cachedClients) {
    cachedClients = createGrpcClients();
  }
  return cachedClients;
}

// createRequestId は相関IDを生成する。
export function createRequestId(): string {
  if (typeof randomUUID === "function") {
    return randomUUID();
  }

  return randomBytes(16).toString("hex");
}

// buildGrpcMetadata は gRPC metadata に入れる userId/requestId を構築する。
export function buildGrpcMetadata(params: { requestId: string; userId?: string }): GrpcMetadata {
  return {
    requestId: params.requestId,
    userId: params.userId,
  };
}

// createMetadataObject は gRPC 実呼び出し用の Metadata を作成する。
function createMetadataObject(metadataValues: GrpcMetadata): Metadata {
  const metadata = new Metadata();
  // 未ログイン時は userId を空で送らず、キー自体を付与しない。
  if (metadataValues.userId && metadataValues.userId.length > 0) {
    metadata.set(METADATA_KEY_USER_ID, metadataValues.userId);
  }
  metadata.set(METADATA_KEY_REQUEST_ID, metadataValues.requestId);
  return metadata;
}

// normalizeCallContext は callContext の必須値とデフォルト値を確定する。
function normalizeCallContext(callContext: GrpcCallContext): { requestId: string; timeoutMs: number; userId: string } {
  return {
    requestId: callContext.requestId ?? createRequestId(),
    timeoutMs: callContext.timeoutMs ?? resolveGrpcTimeoutMs(),
    userId: callContext.userId?.trim() ?? "",
  };
}

// withRequestContext は request.message 側にも requestId を埋め込む。
function withRequestContext<TRequest extends RequestWithContext>(request: TRequest, requestId: string): TRequest {
  const context = request.context ?? {};
  return {
    ...request,
    context: {
      ...context,
      requestId: context.requestId ?? requestId,
    },
  };
}

// invokeUnary は metadata と deadline を付与して unary RPC を呼び出す。
function invokeUnary<TRequest extends RequestWithContext, TResponse>(params: {
  callContext: GrpcCallContext;
  method: UnaryMethod<TRequest, TResponse>;
  request: TRequest;
}): Promise<GrpcCallResult<TResponse>> {
  const normalizedCallContext = normalizeCallContext(params.callContext);
  const requestWithContext = withRequestContext(params.request, normalizedCallContext.requestId);
  const grpcMetadataValues = buildGrpcMetadata({
    requestId: normalizedCallContext.requestId,
    userId: normalizedCallContext.userId,
  });
  const metadataObject = createMetadataObject(grpcMetadataValues);
  const deadline = new Date(Date.now() + normalizedCallContext.timeoutMs);

  return new Promise((resolve, reject) => {
    params.method(requestWithContext, metadataObject, { deadline }, (error, response) => {
      if (error) {
        reject(
          new GrpcCallError({
            grpcError: error,
            requestId: normalizedCallContext.requestId,
          }),
        );
        return;
      }

      resolve({
        requestId: normalizedCallContext.requestId,
        response,
      });
    });
  });
}

type QuizMethod = "getQuestion" | "submitAnswer";
type QuestionMethod = "createQuestion" | "updateQuestion" | "getMyQuestion" | "listMyQuestions";
type UserMethod = "listMyAttempts" | "getMyStats";

// callQuizService は QuizService の unary RPC を共通設定付きで呼び出す。
export function callQuizService<TRequest extends RequestWithContext, TResponse>(params: {
  callContext: GrpcCallContext;
  method: QuizMethod;
  request: TRequest;
}): Promise<GrpcCallResult<TResponse>> {
  const client = getGrpcClients().quiz;
  const method = client[params.method] as UnaryMethod<TRequest, TResponse>;
  return invokeUnary({
    callContext: params.callContext,
    method,
    request: params.request,
  });
}

// callQuestionService は QuestionService の unary RPC を共通設定付きで呼び出す。
export function callQuestionService<TRequest extends RequestWithContext, TResponse>(params: {
  callContext: GrpcCallContext;
  method: QuestionMethod;
  request: TRequest;
}): Promise<GrpcCallResult<TResponse>> {
  const client = getGrpcClients().question;
  const method = client[params.method] as UnaryMethod<TRequest, TResponse>;
  return invokeUnary({
    callContext: params.callContext,
    method,
    request: params.request,
  });
}

// callUserService は UserService の unary RPC を共通設定付きで呼び出す。
export function callUserService<TRequest extends RequestWithContext, TResponse>(params: {
  callContext: GrpcCallContext;
  method: UserMethod;
  request: TRequest;
}): Promise<GrpcCallResult<TResponse>> {
  const client = getGrpcClients().user;
  const method = client[params.method] as UnaryMethod<TRequest, TResponse>;
  return invokeUnary({
    callContext: params.callContext,
    method,
    request: params.request,
  });
}
