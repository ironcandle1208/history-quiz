// QuizService のサーバー専用クライアントラッパー。

import type { GrpcCallContext, GrpcCallResult, RequestContext, RequestWithContext } from "./client.server";
import { callQuizService } from "./client.server";

export type QuizChoice = {
  id: string;
  label: string;
  ordinal: number;
};

export type QuizQuestion = {
  id: string;
  prompt: string;
  choices: QuizChoice[];
  explanation: string;
};

export type GetQuestionRequest = RequestWithContext & {
  previousQuestionId?: string;
};

export type GetQuestionResponse = {
  context?: RequestContext;
  question?: QuizQuestion;
};

export type SubmitAnswerRequest = RequestWithContext & {
  questionId: string;
  selectedChoiceId: string;
};

export type SubmitAnswerResponse = {
  attemptId: string;
  context?: RequestContext;
  correctChoiceId: string;
  isCorrect: boolean;
};

// getQuestion は QuizService/GetQuestion を呼び出す。
export function getQuestion(params: {
  callContext: GrpcCallContext;
  request: GetQuestionRequest;
}): Promise<GrpcCallResult<GetQuestionResponse>> {
  return callQuizService<GetQuestionRequest, GetQuestionResponse>({
    callContext: params.callContext,
    method: "getQuestion",
    request: params.request,
  });
}

// submitAnswer は QuizService/SubmitAnswer を呼び出す。
export function submitAnswer(params: {
  callContext: GrpcCallContext;
  request: SubmitAnswerRequest;
}): Promise<GrpcCallResult<SubmitAnswerResponse>> {
  return callQuizService<SubmitAnswerRequest, SubmitAnswerResponse>({
    callContext: params.callContext,
    method: "submitAnswer",
    request: params.request,
  });
}
