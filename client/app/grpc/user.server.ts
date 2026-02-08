// UserService のサーバー専用クライアントラッパー。

import type { GrpcCallContext, GrpcCallResult, RequestContext, RequestWithContext } from "./client.server";
import { callUserService } from "./client.server";

export type Pagination = {
  pageSize?: number;
  pageToken?: string;
};

export type PageInfo = {
  nextPageToken?: string;
};

export type Attempt = {
  id: string;
  questionId: string;
  questionPrompt: string;
  selectedChoiceId: string;
  isCorrect: boolean;
  answeredAt: string;
};

export type Stats = {
  totalAttempts: string;
  correctAttempts: string;
  accuracy: number;
};

export type ListMyAttemptsRequest = RequestWithContext & {
  pagination?: Pagination;
};

export type ListMyAttemptsResponse = {
  attempts: Attempt[];
  context?: RequestContext;
  pageInfo?: PageInfo;
};

export type GetMyStatsRequest = RequestWithContext;

export type GetMyStatsResponse = {
  context?: RequestContext;
  stats?: Stats;
};

// listMyAttempts は UserService/ListMyAttempts を呼び出す。
export function listMyAttempts(params: {
  callContext: GrpcCallContext;
  request: ListMyAttemptsRequest;
}): Promise<GrpcCallResult<ListMyAttemptsResponse>> {
  return callUserService<ListMyAttemptsRequest, ListMyAttemptsResponse>({
    callContext: params.callContext,
    method: "listMyAttempts",
    request: params.request,
  });
}

// getMyStats は UserService/GetMyStats を呼び出す。
export function getMyStats(params: {
  callContext: GrpcCallContext;
  request: GetMyStatsRequest;
}): Promise<GrpcCallResult<GetMyStatsResponse>> {
  return callUserService<GetMyStatsRequest, GetMyStatsResponse>({
    callContext: params.callContext,
    method: "getMyStats",
    request: params.request,
  });
}
