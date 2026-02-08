// QuestionService のサーバー専用クライアントラッパー。

import type { GrpcCallContext, GrpcCallResult, RequestContext, RequestWithContext } from "./client.server";
import { callQuestionService } from "./client.server";

export type Pagination = {
  pageSize?: number;
  pageToken?: string;
};

export type PageInfo = {
  nextPageToken?: string;
};

export type QuestionChoice = {
  id: string;
  label: string;
  ordinal: number;
};

export type QuestionSummary = {
  id: string;
  prompt: string;
  updatedAt: string;
};

export type QuestionDetail = {
  id: string;
  prompt: string;
  choices: QuestionChoice[];
  correctChoiceId: string;
  explanation: string;
  updatedAt: string;
};

export type QuestionDraft = {
  prompt: string;
  choices: string[];
  correctOrdinal: number;
  explanation?: string;
};

export type CreateQuestionRequest = RequestWithContext & {
  draft: QuestionDraft;
};

export type CreateQuestionResponse = {
  context?: RequestContext;
  question?: QuestionDetail;
};

export type UpdateQuestionRequest = RequestWithContext & {
  questionId: string;
  draft: QuestionDraft;
};

export type UpdateQuestionResponse = {
  context?: RequestContext;
  question?: QuestionDetail;
};

export type GetMyQuestionRequest = RequestWithContext & {
  questionId: string;
};

export type GetMyQuestionResponse = {
  context?: RequestContext;
  question?: QuestionDetail;
};

export type ListMyQuestionsRequest = RequestWithContext & {
  pagination?: Pagination;
};

export type ListMyQuestionsResponse = {
  context?: RequestContext;
  pageInfo?: PageInfo;
  questions: QuestionSummary[];
};

// createQuestion は QuestionService/CreateQuestion を呼び出す。
export function createQuestion(params: {
  callContext: GrpcCallContext;
  request: CreateQuestionRequest;
}): Promise<GrpcCallResult<CreateQuestionResponse>> {
  return callQuestionService<CreateQuestionRequest, CreateQuestionResponse>({
    callContext: params.callContext,
    method: "createQuestion",
    request: params.request,
  });
}

// updateQuestion は QuestionService/UpdateQuestion を呼び出す。
export function updateQuestion(params: {
  callContext: GrpcCallContext;
  request: UpdateQuestionRequest;
}): Promise<GrpcCallResult<UpdateQuestionResponse>> {
  return callQuestionService<UpdateQuestionRequest, UpdateQuestionResponse>({
    callContext: params.callContext,
    method: "updateQuestion",
    request: params.request,
  });
}

// getMyQuestion は QuestionService/GetMyQuestion を呼び出す。
export function getMyQuestion(params: {
  callContext: GrpcCallContext;
  request: GetMyQuestionRequest;
}): Promise<GrpcCallResult<GetMyQuestionResponse>> {
  return callQuestionService<GetMyQuestionRequest, GetMyQuestionResponse>({
    callContext: params.callContext,
    method: "getMyQuestion",
    request: params.request,
  });
}

// listMyQuestions は QuestionService/ListMyQuestions を呼び出す。
export function listMyQuestions(params: {
  callContext: GrpcCallContext;
  request: ListMyQuestionsRequest;
}): Promise<GrpcCallResult<ListMyQuestionsResponse>> {
  return callQuestionService<ListMyQuestionsRequest, ListMyQuestionsResponse>({
    callContext: params.callContext,
    method: "listMyQuestions",
    request: params.request,
  });
}
