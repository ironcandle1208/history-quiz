package observability

import (
	"testing"
	"time"

	"google.golang.org/grpc/codes"
)

// TestCollectorSnapshot は件数・エラー率・p95 の基本集計を検証する。
func TestCollectorSnapshot(t *testing.T) {
	t.Parallel()

	collector := NewCollector(10)
	collector.RecordRPC("/historyquiz.quiz.v1.QuizService/GetQuestion", codes.OK, 10*time.Millisecond)
	collector.RecordRPC("/historyquiz.quiz.v1.QuizService/GetQuestion", codes.OK, 20*time.Millisecond)
	collector.RecordRPC("/historyquiz.quiz.v1.QuizService/GetQuestion", codes.Internal, 30*time.Millisecond)
	collector.RecordRPC("/historyquiz.quiz.v1.QuizService/GetQuestion", codes.OK, 40*time.Millisecond)
	collector.RecordRPC("/historyquiz.quiz.v1.QuizService/GetQuestion", codes.OK, 50*time.Millisecond)

	snapshot := collector.Snapshot()
	if len(snapshot.Methods) != 1 {
		t.Fatalf("unexpected method count: got=%d want=1", len(snapshot.Methods))
	}

	method := snapshot.Methods[0]
	if method.RequestCount != 5 {
		t.Fatalf("unexpected request count: got=%d want=5", method.RequestCount)
	}
	if method.ErrorCount != 1 {
		t.Fatalf("unexpected error count: got=%d want=1", method.ErrorCount)
	}
	if method.ErrorRate != 0.2 {
		t.Fatalf("unexpected error rate: got=%f want=0.2", method.ErrorRate)
	}
	if method.P95LatencyMs != 50 {
		t.Fatalf("unexpected p95 latency: got=%f want=50", method.P95LatencyMs)
	}
}

// TestCollectorMaxSampleWindow はサンプル上限超過時に古いデータが捨てられることを検証する。
func TestCollectorMaxSampleWindow(t *testing.T) {
	t.Parallel()

	collector := NewCollector(3)
	collector.RecordRPC("/historyquiz.question.v1.QuestionService/ListMyQuestions", codes.OK, 10*time.Millisecond)
	collector.RecordRPC("/historyquiz.question.v1.QuestionService/ListMyQuestions", codes.OK, 20*time.Millisecond)
	collector.RecordRPC("/historyquiz.question.v1.QuestionService/ListMyQuestions", codes.OK, 30*time.Millisecond)
	collector.RecordRPC("/historyquiz.question.v1.QuestionService/ListMyQuestions", codes.OK, 40*time.Millisecond)

	snapshot := collector.Snapshot()
	if len(snapshot.Methods) != 1 {
		t.Fatalf("unexpected method count: got=%d want=1", len(snapshot.Methods))
	}

	method := snapshot.Methods[0]
	if method.P95LatencyMs != 40 {
		t.Fatalf("unexpected p95 latency: got=%f want=40", method.P95LatencyMs)
	}
}
