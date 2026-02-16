import { randomBytes, randomUUID } from "node:crypto";

const DEFAULT_MAX_LATENCY_SAMPLES = 512;
const DEFAULT_REPORT_INTERVAL_SECONDS = 60;
const REPORT_INTERVAL_ENV_NAME = "CLIENT_OBSERVABILITY_REPORT_INTERVAL_SECONDS";
const UUID_SEGMENT_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NUMERIC_SEGMENT_PATTERN = /^\d+$/;

type MetricScope = "grpc" | "http";

type MetricWindow = {
  errorCount: number;
  latenciesMs: number[];
  requestCount: number;
};

type MetricSnapshot = {
  errorCount: number;
  errorRate: number;
  name: string;
  p95LatencyMs: number;
  requestCount: number;
  scope: MetricScope;
};

const metricStore = new Map<string, MetricWindow>();
let reportTimerStarted = false;

// createObservabilityRequestId は可観測性ログに使う requestId を生成する。
export function createObservabilityRequestId(): string {
  if (typeof randomUUID === "function") {
    return randomUUID();
  }
  return randomBytes(16).toString("hex");
}

// ensureObservabilityReporterStarted はメトリクス定期出力タイマーを一度だけ起動する。
export function ensureObservabilityReporterStarted(): void {
  if (reportTimerStarted || process.env.NODE_ENV === "test") {
    return;
  }
  reportTimerStarted = true;

  const intervalMs = resolveReportIntervalMs();
  const timer = setInterval(() => {
    emitMetricsSnapshot();
  }, intervalMs);
  if (typeof (timer as { unref?: () => void }).unref === "function") {
    (timer as { unref: () => void }).unref();
  }
}

// observeHttpRequest は Remix HTTP リクエストのアクセスログとメトリクスを記録する。
export function observeHttpRequest(params: {
  request: Request;
  requestId?: string;
  responseStatus: number;
  routeId?: string;
  startedAtMs: number;
  userId?: string;
}): void {
  const pathname = normalizePathname(new URL(params.request.url).pathname);
  const methodWithPath = `${params.request.method.toUpperCase()} ${pathname}`;
  const metricName = params.routeId?.trim() || methodWithPath;
  const latencyMs = Math.max(Date.now() - params.startedAtMs, 0);
  const requestId = resolveRequestId(params.requestId);
  const statusClass = toHttpStatusClass(params.responseStatus);

  recordMetric({
    isError: params.responseStatus >= 500,
    latencyMs,
    name: metricName,
    scope: "http",
  });

  writeStructuredLog({
    at: new Date().toISOString(),
    latencyMs,
    method: methodWithPath,
    requestId,
    status: String(params.responseStatus),
    statusClass,
    type: "http_access",
    userId: params.userId,
  });
}

// observeGrpcCall は Remix から Backend への gRPC 呼び出し結果を記録する。
export function observeGrpcCall(params: {
  grpcCode: string;
  requestId?: string;
  rpcMethod: string;
  startedAtMs: number;
  userId?: string;
}): void {
  const normalizedCode = normalizeGrpcCode(params.grpcCode);
  const requestId = resolveRequestId(params.requestId);
  const latencyMs = Math.max(Date.now() - params.startedAtMs, 0);
  const isError = normalizedCode !== "OK";

  recordMetric({
    isError,
    latencyMs,
    name: params.rpcMethod.trim() || "unknown",
    scope: "grpc",
  });

  writeStructuredLog({
    at: new Date().toISOString(),
    latencyMs,
    method: params.rpcMethod,
    requestId,
    status: normalizedCode,
    type: "grpc_client_access",
    userId: params.userId,
  });
}

// observeServerFault は SSR 処理中の例外を構造化ログとして記録する。
export function observeServerFault(params: {
  detail?: unknown;
  message: string;
  requestId?: string;
  source: string;
  userId?: string;
}): void {
  writeStructuredLog({
    at: new Date().toISOString(),
    detail: params.detail,
    message: params.message,
    requestId: resolveRequestId(params.requestId),
    source: params.source,
    type: "server_fault",
    userId: params.userId,
  });
}

// getMetricSnapshots は現在保持しているメトリクスを集計して返す。
export function getMetricSnapshots(): MetricSnapshot[] {
  const snapshots: MetricSnapshot[] = [];

  for (const [key, window] of metricStore.entries()) {
    const [scope, ...nameParts] = key.split(":");
    const name = nameParts.join(":");
    const requestCount = window.requestCount;
    const errorCount = window.errorCount;
    const errorRate = requestCount > 0 ? errorCount / requestCount : 0;

    snapshots.push({
      errorCount,
      errorRate,
      name,
      p95LatencyMs: calculateP95(window.latenciesMs),
      requestCount,
      scope: scope as MetricScope,
    });
  }

  snapshots.sort((a, b) => {
    if (a.scope === b.scope) {
      return a.name.localeCompare(b.name);
    }
    return a.scope.localeCompare(b.scope);
  });

  return snapshots;
}

// resolveReportIntervalMs は定期出力間隔を環境変数からミリ秒へ解決する。
function resolveReportIntervalMs(): number {
  const raw = process.env[REPORT_INTERVAL_ENV_NAME];
  if (!raw) {
    return DEFAULT_REPORT_INTERVAL_SECONDS * 1_000;
  }

  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return DEFAULT_REPORT_INTERVAL_SECONDS * 1_000;
  }
  return parsed * 1_000;
}

// emitMetricsSnapshot は HTTP/gRPC のメトリクス集計結果をログへ出力する。
function emitMetricsSnapshot(): void {
  const metrics = getMetricSnapshots();
  if (metrics.length === 0) {
    return;
  }

  writeStructuredLog({
    at: new Date().toISOString(),
    metrics,
    type: "server_metrics_snapshot",
  });
}

// resolveRequestId は未指定の requestId を補完して返す。
function resolveRequestId(requestId?: string): string {
  const normalized = requestId?.trim();
  if (normalized) {
    return normalized;
  }
  return createObservabilityRequestId();
}

// normalizeGrpcCode は gRPC ステータス文字列を正規化する。
function normalizeGrpcCode(code: string): string {
  const normalized = code.trim().toUpperCase();
  return normalized.length > 0 ? normalized : "UNKNOWN";
}

// toHttpStatusClass は HTTP ステータスを 2xx/4xx の粒度へ丸める。
function toHttpStatusClass(status: number): string {
  if (!Number.isFinite(status) || status <= 0) {
    return "unknown";
  }
  return `${Math.floor(status / 100)}xx`;
}

// normalizePathname は可観測性のキー爆発を防ぐため動的セグメントを正規化する。
function normalizePathname(pathname: string): string {
  const segments = pathname
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => {
      if (UUID_SEGMENT_PATTERN.test(segment) || NUMERIC_SEGMENT_PATTERN.test(segment)) {
        return ":id";
      }
      return segment;
    });

  return `/${segments.join("/")}`;
}

// recordMetric は scope/name 単位で件数・エラー件数・レイテンシを集計する。
function recordMetric(params: { isError: boolean; latencyMs: number; name: string; scope: MetricScope }): void {
  const key = `${params.scope}:${params.name}`;
  const current = metricStore.get(key) ?? {
    errorCount: 0,
    latenciesMs: [],
    requestCount: 0,
  };

  current.requestCount += 1;
  if (params.isError) {
    current.errorCount += 1;
  }
  current.latenciesMs = appendLatencySample(current.latenciesMs, params.latencyMs, DEFAULT_MAX_LATENCY_SAMPLES);
  metricStore.set(key, current);
}

// appendLatencySample は固定長のサンプル窓へレイテンシを追加する。
function appendLatencySample(samples: number[], latencyMs: number, maxSamples: number): number[] {
  if (maxSamples <= 0) {
    return [latencyMs];
  }

  if (samples.length < maxSamples) {
    return [...samples, latencyMs];
  }

  const shifted = samples.slice(1);
  shifted.push(latencyMs);
  return shifted;
}

// calculateP95 はサンプル配列から p95 レイテンシを算出する。
function calculateP95(samples: number[]): number {
  if (samples.length === 0) {
    return 0;
  }

  const sorted = [...samples].sort((a, b) => a - b);
  const index = Math.max(Math.ceil(sorted.length * 0.95) - 1, 0);
  return sorted[Math.min(index, sorted.length - 1)];
}

// writeStructuredLog は JSON 1 行形式でサーバーログへ出力する。
function writeStructuredLog(payload: Record<string, unknown>): void {
  const encoded = JSON.stringify(payload);
  if (payload.type === "server_fault") {
    console.error(encoded);
    return;
  }
  console.info(encoded);
}
