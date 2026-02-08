// マイページ（履歴/正答率/自作問題一覧）を提供するルート。

import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, isRouteErrorResponse, useLoaderData, useRouteError } from "@remix-run/react";

import { createRequestId } from "../grpc/client.server";
import { listMyQuestions } from "../grpc/question.server";
import { getMyStats, listMyAttempts, type Stats } from "../grpc/user.server";
import { requireAuthenticatedUser } from "../services/auth.server";
import { throwGrpcErrorResponse } from "../services/grpc-error.server";

const LIST_PAGE_SIZE = 20;

type LoaderData = {
  attempts: {
    id: string;
    isCorrect: boolean;
    questionId: string;
    questionPrompt: string;
    selectedChoiceId: string;
    answeredAt: string;
  }[];
  questions: {
    id: string;
    prompt: string;
    updatedAt: string;
  }[];
  requestId: string;
  stats: {
    accuracy: number;
    correctAttempts: string;
    totalAttempts: string;
  };
  userId: string;
};

// toSafeStats は stats が未設定でも UI 表示用に安全な既定値を返す。
function toSafeStats(stats: Stats | undefined): LoaderData["stats"] {
  if (!stats) {
    return {
      accuracy: 0,
      correctAttempts: "0",
      totalAttempts: "0",
    };
  }

  return {
    accuracy: Number.isFinite(stats.accuracy) ? stats.accuracy : 0,
    correctAttempts: stats.correctAttempts,
    totalAttempts: stats.totalAttempts,
  };
}

// toAccuracyLabel は 0.0..1.0 の正答率を 0.0% 表記へ変換する。
function toAccuracyLabel(accuracy: number): string {
  const normalized = Math.max(0, Math.min(1, accuracy));
  return `${(normalized * 100).toFixed(1)}%`;
}

// toDisplayDateTime は RFC3339 文字列を日本語ロケールの表示へ変換する。
function toDisplayDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tokyo",
  }).format(parsed);
}

// loader はマイページの各セクションに必要なデータを gRPC から取得する。
export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireAuthenticatedUser(request);
  const requestId = createRequestId();

  try {
    const [attemptsResult, statsResult, questionsResult] = await Promise.all([
      listMyAttempts({
        callContext: { requestId, userId: user.userId },
        request: {
          pagination: { pageSize: LIST_PAGE_SIZE },
        },
      }),
      getMyStats({
        callContext: { requestId, userId: user.userId },
        request: {},
      }),
      listMyQuestions({
        callContext: { requestId, userId: user.userId },
        request: {
          pagination: { pageSize: LIST_PAGE_SIZE },
        },
      }),
    ]);

    return json<LoaderData>(
      {
        attempts: attemptsResult.response.attempts,
        questions: questionsResult.response.questions,
        requestId,
        stats: toSafeStats(statsResult.response.stats),
        userId: user.userId,
      },
      {
        headers: { "x-request-id": requestId },
      },
    );
  } catch (error) {
    throwGrpcErrorResponse({
      error,
      fallbackMessage: "マイページの取得に失敗しました。時間をおいて再試行してください。",
      requestId,
    });
  }
}

export default function MeRoute() {
  const data = useLoaderData<typeof loader>();
  const hasAttempts = data.attempts.length > 0;
  const hasQuestions = data.questions.length > 0;

  return (
    <section className="card">
      <h1>マイページ</h1>
      <p className="muted">
        ログイン中ユーザー: <code>{data.userId}</code>
      </p>

      <h2>学習統計</h2>
      <ul>
        <li>
          解答数: <strong>{data.stats.totalAttempts}</strong>
        </li>
        <li>
          正解数: <strong>{data.stats.correctAttempts}</strong>
        </li>
        <li>
          正答率: <strong>{toAccuracyLabel(data.stats.accuracy)}</strong>
        </li>
      </ul>

      <h2>解答履歴</h2>
      {hasAttempts ? (
        <ol>
          {data.attempts.map((attempt) => (
            <li key={attempt.id}>
              <p>
                問題: <strong>{attempt.questionPrompt || "（問題文なし）"}</strong>
              </p>
              <p className="muted">
                判定: {attempt.isCorrect ? "正解" : "不正解"} / choiceId: <code>{attempt.selectedChoiceId}</code>
              </p>
              <p className="muted">
                回答日時: <time dateTime={attempt.answeredAt}>{toDisplayDateTime(attempt.answeredAt)}</time>
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted">まだ解答履歴がありません。クイズに挑戦するとここに表示されます。</p>
      )}

      <h2>自作問題一覧</h2>
      {hasQuestions ? (
        <ul>
          {data.questions.map((question) => (
            <li key={question.id}>
              <Link to={`/questions/${question.id}/edit`}>{question.prompt || "（問題文なし）"}</Link>
              <p className="muted">
                更新日時: <time dateTime={question.updatedAt}>{toDisplayDateTime(question.updatedAt)}</time>
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">まだ作成した問題がありません。問題作成から追加できます。</p>
      )}

      <p className="muted">
        requestId: <code>{data.requestId}</code>
      </p>
    </section>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();

  let message = "マイページの表示中にエラーが発生しました。";
  let requestId: string | undefined;

  if (isRouteErrorResponse(error)) {
    const data = error.data as { error?: { message?: string }; requestId?: string } | undefined;
    if (typeof data?.error?.message === "string" && data.error.message.length > 0) {
      message = data.error.message;
    }
    if (typeof data?.requestId === "string" && data.requestId.length > 0) {
      requestId = data.requestId;
    }
  }

  return (
    <section className="card">
      <h1>マイページ</h1>
      <p style={{ color: "#ffb4b4" }}>{message}</p>
      {requestId ? (
        <p className="muted">
          requestId: <code>{requestId}</code>
        </p>
      ) : null}
      <p>
        <Link to="/me">再試行する</Link>
      </p>
    </section>
  );
}
