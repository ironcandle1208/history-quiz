// gRPC → HTTP のエラー変換を共通化する（サーバー専用）。
// docs/tech.md の変換表を単一の真実として適用する。

import { status as grpcStatus, type Metadata, type ServiceError } from "@grpc/grpc-js";
import { json, type TypedResponse } from "@remix-run/node";

import { isGrpcCallError } from "../grpc/client.server";

const REQUEST_ID_METADATA_KEYS = ["x-request-id", "request-id"] as const;
const FIELD_VIOLATIONS_METADATA_KEYS = [
  "x-field-violations",
  "field-violations",
  "x-error-field-violations",
  "error-field-violations",
] as const;

const GRPC_STATUS_BY_NUMBER: Record<number, string> = {
  [grpcStatus.OK]: "OK",
  [grpcStatus.CANCELLED]: "CANCELLED",
  [grpcStatus.UNKNOWN]: "UNKNOWN",
  [grpcStatus.INVALID_ARGUMENT]: "INVALID_ARGUMENT",
  [grpcStatus.DEADLINE_EXCEEDED]: "DEADLINE_EXCEEDED",
  [grpcStatus.NOT_FOUND]: "NOT_FOUND",
  [grpcStatus.ALREADY_EXISTS]: "ALREADY_EXISTS",
  [grpcStatus.PERMISSION_DENIED]: "PERMISSION_DENIED",
  [grpcStatus.RESOURCE_EXHAUSTED]: "RESOURCE_EXHAUSTED",
  [grpcStatus.FAILED_PRECONDITION]: "FAILED_PRECONDITION",
  [grpcStatus.ABORTED]: "ABORTED",
  [grpcStatus.OUT_OF_RANGE]: "OUT_OF_RANGE",
  [grpcStatus.UNIMPLEMENTED]: "UNIMPLEMENTED",
  [grpcStatus.INTERNAL]: "INTERNAL",
  [grpcStatus.UNAVAILABLE]: "UNAVAILABLE",
  [grpcStatus.DATA_LOSS]: "DATA_LOSS",
  [grpcStatus.UNAUTHENTICATED]: "UNAUTHENTICATED",
};

const GRPC_CODE_TO_HTTP_STATUS: Record<string, number> = {
  ABORTED: 409,
  ALREADY_EXISTS: 409,
  DATA_LOSS: 500,
  DEADLINE_EXCEEDED: 504,
  FAILED_PRECONDITION: 409,
  INTERNAL: 500,
  INVALID_ARGUMENT: 400,
  NOT_FOUND: 404,
  OUT_OF_RANGE: 400,
  PERMISSION_DENIED: 403,
  RESOURCE_EXHAUSTED: 429,
  UNAUTHENTICATED: 401,
  UNAVAILABLE: 503,
  UNIMPLEMENTED: 501,
  UNKNOWN: 500,
};

const SENSITIVE_GRPC_CODES = new Set(["INTERNAL", "UNKNOWN", "DATA_LOSS"]);

const DEFAULT_USER_MESSAGES: Record<string, string> = {
  ABORTED: "競合が発生しました。再度お試しください。",
  ALREADY_EXISTS: "すでに同じデータが存在します。",
  DATA_LOSS: "サーバー内部でエラーが発生しました。時間をおいて再試行してください。",
  DEADLINE_EXCEEDED: "処理がタイムアウトしました。時間をおいて再試行してください。",
  FAILED_PRECONDITION: "現在の状態ではこの操作を実行できません。",
  INTERNAL: "サーバー内部でエラーが発生しました。時間をおいて再試行してください。",
  INVALID_ARGUMENT: "入力内容を確認してください。",
  NOT_FOUND: "対象データが見つかりませんでした。",
  OUT_OF_RANGE: "入力値が許可範囲外です。",
  PERMISSION_DENIED: "権限がありません。",
  RESOURCE_EXHAUSTED: "アクセスが集中しています。しばらくしてから再試行してください。",
  UNAUTHENTICATED: "ログインが必要です。",
  UNAVAILABLE: "現在サービスを利用できません。時間をおいて再試行してください。",
  UNIMPLEMENTED: "未実装の機能です。",
  UNKNOWN: "サーバー内部でエラーが発生しました。時間をおいて再試行してください。",
};

export type FieldViolation = {
  description: string;
  field: string;
};

export type FieldErrors = Record<string, string>;

export type HttpErrorPayload = {
  error: {
    code: string;
    details?: {
      fieldViolations?: FieldViolation[];
    };
    message: string;
  };
  requestId?: string;
};

export type NormalizedGrpcHttpError = {
  fieldErrors: FieldErrors;
  grpcCode: string;
  httpStatus: number;
  payload: HttpErrorPayload;
  requestId?: string;
};

type NormalizeGrpcHttpErrorParams = {
  error: unknown;
  fallbackMessage?: string;
  requestId?: string;
};

// mapGrpcCodeToHttpStatus は gRPC status code を HTTP ステータスへ変換する。
// NOTE: ルートごとの個別変換を禁止し、運用時の調査性を維持する。
export function mapGrpcCodeToHttpStatus(code: string | number): number {
  const grpcCodeName = toGrpcCodeName(code);
  return GRPC_CODE_TO_HTTP_STATUS[grpcCodeName] ?? 500;
}

// normalizeGrpcHttpError は gRPC エラーを HTTP 用の共通形式に正規化する。
export function normalizeGrpcHttpError(params: NormalizeGrpcHttpErrorParams): NormalizedGrpcHttpError {
  const extracted = extractServiceError(params.error);
  const grpcCode = toGrpcCodeName(extracted.serviceError?.code);
  const requestId = resolveRequestId({
    explicitRequestId: params.requestId,
    metadata: extracted.serviceError?.metadata,
    wrappedRequestId: extracted.wrappedRequestId,
  });
  const fieldViolations = parseFieldViolations(extracted.serviceError?.metadata);
  const fieldErrors = toFieldErrors(fieldViolations);
  const message = buildUserFacingMessage({
    fallbackMessage: params.fallbackMessage,
    grpcCode,
    serviceMessage: extracted.serviceError?.details,
  });
  const payload: HttpErrorPayload = {
    error: {
      code: grpcCode,
      message,
      details: fieldViolations.length > 0 ? { fieldViolations } : undefined,
    },
    requestId,
  };

  return {
    fieldErrors,
    grpcCode,
    httpStatus: mapGrpcCodeToHttpStatus(grpcCode),
    payload,
    requestId,
  };
}

// createGrpcErrorResponse は共通フォーマットの JSON エラーレスポンスを作る。
export function createGrpcErrorResponse(params: NormalizeGrpcHttpErrorParams): TypedResponse<HttpErrorPayload> {
  const normalized = normalizeGrpcHttpError(params);
  return json(normalized.payload, {
    status: normalized.httpStatus,
    headers: normalized.requestId ? { "x-request-id": normalized.requestId } : undefined,
  });
}

// throwGrpcErrorResponse は共通エラーレスポンスを throw する。
export function throwGrpcErrorResponse(params: NormalizeGrpcHttpErrorParams): never {
  throw createGrpcErrorResponse(params);
}

// toGrpcCodeName は数値/文字列の gRPC code を正規化したコード名へ変換する。
function toGrpcCodeName(code: number | string | undefined): string {
  if (typeof code === "number") {
    return GRPC_STATUS_BY_NUMBER[code] ?? "UNKNOWN";
  }

  if (typeof code === "string") {
    const normalized = code.trim().toUpperCase();
    if (normalized.length === 0) {
      return "UNKNOWN";
    }
    return normalized in GRPC_CODE_TO_HTTP_STATUS ? normalized : "UNKNOWN";
  }

  return "UNKNOWN";
}

// extractServiceError はラップ済み gRPC エラーから ServiceError を取り出す。
function extractServiceError(error: unknown): { serviceError?: ServiceError; wrappedRequestId?: string } {
  if (isGrpcCallError(error)) {
    return {
      serviceError: asServiceError(error.grpcError),
      wrappedRequestId: error.requestId,
    };
  }

  return {
    serviceError: asServiceError(error),
  };
}

// asServiceError は unknown を ServiceError として扱える場合のみ返す。
function asServiceError(error: unknown): ServiceError | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }
  if (!("details" in error) || !("metadata" in error) || !("code" in error)) {
    return undefined;
  }
  return error as ServiceError;
}

// resolveRequestId は明示値・ラップ値・metadata の順で requestId を決定する。
function resolveRequestId(params: {
  explicitRequestId?: string;
  metadata?: Metadata;
  wrappedRequestId?: string;
}): string | undefined {
  if (hasText(params.explicitRequestId)) {
    return params.explicitRequestId?.trim();
  }
  if (hasText(params.wrappedRequestId)) {
    return params.wrappedRequestId?.trim();
  }
  if (!params.metadata) {
    return undefined;
  }

  for (const key of REQUEST_ID_METADATA_KEYS) {
    const metadataValue = getMetadataString(params.metadata, key);
    if (hasText(metadataValue)) {
      return metadataValue?.trim();
    }
  }

  return undefined;
}

// parseFieldViolations は metadata からフィールドエラーを抽出する。
function parseFieldViolations(metadata: Metadata | undefined): FieldViolation[] {
  if (!metadata) {
    return [];
  }

  for (const key of FIELD_VIOLATIONS_METADATA_KEYS) {
    const raw = getMetadataString(metadata, key);
    if (!hasText(raw)) {
      continue;
    }
    const parsed = parseFieldViolationsFromJson(raw ?? "");
    if (parsed.length > 0) {
      return parsed;
    }
  }

  return [];
}

// parseFieldViolationsFromJson は JSON 文字列からフィールドエラー配列を復元する。
function parseFieldViolationsFromJson(value: string): FieldViolation[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return coerceFieldViolations(parsed);
  } catch {
    return [];
  }
}

// coerceFieldViolations は複数フォーマットを FieldViolation[] へ正規化する。
function coerceFieldViolations(input: unknown): FieldViolation[] {
  if (Array.isArray(input)) {
    return input.map(toFieldViolation).filter((item): item is FieldViolation => item !== null);
  }

  if (input && typeof input === "object") {
    const objectValue = input as Record<string, unknown>;
    const maybeViolations = objectValue.fieldViolations ?? objectValue.field_violations;
    if (Array.isArray(maybeViolations)) {
      return maybeViolations.map(toFieldViolation).filter((item): item is FieldViolation => item !== null);
    }
  }

  return [];
}

// toFieldViolation は unknown を FieldViolation に変換できる場合だけ返す。
function toFieldViolation(input: unknown): FieldViolation | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const objectValue = input as Record<string, unknown>;
  const field = typeof objectValue.field === "string" ? objectValue.field.trim() : "";
  const descriptionCandidate = objectValue.description ?? objectValue.message;
  const description = typeof descriptionCandidate === "string" ? descriptionCandidate.trim() : "";
  if (field.length === 0 || description.length === 0) {
    return null;
  }

  return { field, description };
}

// toFieldErrors は FieldViolation[] をフォーム表示向けの map に変換する。
function toFieldErrors(fieldViolations: FieldViolation[]): FieldErrors {
  const mapped: FieldErrors = {};
  for (const violation of fieldViolations) {
    mapped[violation.field] = violation.description;
  }
  return mapped;
}

// buildUserFacingMessage はコードと例外内容から UI 表示用メッセージを決定する。
function buildUserFacingMessage(params: {
  fallbackMessage?: string;
  grpcCode: string;
  serviceMessage?: string;
}): string {
  if (hasText(params.fallbackMessage)) {
    return params.fallbackMessage?.trim() ?? "エラーが発生しました。";
  }

  if (SENSITIVE_GRPC_CODES.has(params.grpcCode)) {
    return DEFAULT_USER_MESSAGES[params.grpcCode] ?? "サーバー内部でエラーが発生しました。";
  }

  if (hasText(params.serviceMessage)) {
    return params.serviceMessage?.trim() ?? "エラーが発生しました。";
  }

  return DEFAULT_USER_MESSAGES[params.grpcCode] ?? "エラーが発生しました。";
}

// getMetadataString は metadata から文字列として扱える最初の値を取得する。
function getMetadataString(metadata: Metadata, key: string): string | undefined {
  const values = metadata.get(key);
  if (!Array.isArray(values) || values.length === 0) {
    return undefined;
  }

  const firstValue = values[0];
  if (typeof firstValue === "string") {
    return firstValue;
  }
  if (firstValue instanceof Uint8Array) {
    return new TextDecoder().decode(firstValue);
  }

  return undefined;
}

// hasText は trim 後に空でない文字列かどうかを判定する。
function hasText(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}
