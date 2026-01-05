package user

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/history-quiz/historyquiz/internal/domain"
	"github.com/history-quiz/historyquiz/internal/domain/apperror"
)

// fakeAttemptRepo は user.Usecase のユニットテスト用の AttemptRepository 実装。
type fakeAttemptRepo struct {
	listMyAttemptsFn func(ctx context.Context, userID string, limit int32) ([]domain.Attempt, error)
	getMyStatsFn     func(ctx context.Context, userID string) (domain.Stats, error)
	createAttemptFn  func(ctx context.Context, userID string, questionID string, selectedChoiceID string, isCorrect bool) (string, error)
}

func (f *fakeAttemptRepo) CreateAttempt(ctx context.Context, userID string, questionID string, selectedChoiceID string, isCorrect bool) (string, error) {
	return f.createAttemptFn(ctx, userID, questionID, selectedChoiceID, isCorrect)
}
func (f *fakeAttemptRepo) ListMyAttempts(ctx context.Context, userID string, limit int32) ([]domain.Attempt, error) {
	return f.listMyAttemptsFn(ctx, userID, limit)
}
func (f *fakeAttemptRepo) GetMyStats(ctx context.Context, userID string) (domain.Stats, error) {
	return f.getMyStatsFn(ctx, userID)
}

// mustUUID はテスト用に UUID を生成する。
func mustUUID(t *testing.T) string {
	t.Helper()
	return uuid.NewString()
}

func TestUsecase_ListMyAttempts_Unauthenticated(t *testing.T) {
	t.Parallel()

	u := NewUsecase(&fakeAttemptRepo{
		listMyAttemptsFn: func(context.Context, string, int32) ([]domain.Attempt, error) {
			t.Fatal("未認証の場合、repo は呼ばれない想定です")
			return nil, nil
		},
		getMyStatsFn: func(context.Context, string) (domain.Stats, error) {
			t.Fatal("not used")
			return domain.Stats{}, nil
		},
		createAttemptFn: func(context.Context, string, string, string, bool) (string, error) {
			t.Fatal("not used")
			return "", nil
		},
	})

	_, _, err := u.ListMyAttempts(context.Background(), "", 10)
	if !apperror.IsCode(err, apperror.CodeUnauthenticated) {
		t.Fatalf("UNAUTHENTICATED を期待しました: err=%v", err)
	}
}

func TestUsecase_ListMyAttempts_NormalizesPageSize(t *testing.T) {
	t.Parallel()

	userID := mustUUID(t)
	gotLimit := int32(-1)

	u := NewUsecase(&fakeAttemptRepo{
		listMyAttemptsFn: func(ctx context.Context, gotUserID string, limit int32) ([]domain.Attempt, error) {
			if gotUserID != userID {
				t.Fatalf("ListMyAttempts user mismatch: got=%s want=%s", gotUserID, userID)
			}
			gotLimit = limit
			return []domain.Attempt{
				{ID: "a1", QuestionID: "q1", AnsweredAt: time.Unix(0, 0)},
			}, nil
		},
		getMyStatsFn: func(context.Context, string) (domain.Stats, error) {
			t.Fatal("not used")
			return domain.Stats{}, nil
		},
		createAttemptFn: func(context.Context, string, string, string, bool) (string, error) {
			t.Fatal("not used")
			return "", nil
		},
	})

	_, _, err := u.ListMyAttempts(context.Background(), userID, 999)
	if err != nil {
		t.Fatalf("err should be nil: %v", err)
	}
	if gotLimit != 100 {
		t.Fatalf("pageSize>100 は 100 を期待: got=%d", gotLimit)
	}
}

func TestUsecase_GetMyStats_Unauthenticated(t *testing.T) {
	t.Parallel()

	u := NewUsecase(&fakeAttemptRepo{
		listMyAttemptsFn: func(context.Context, string, int32) ([]domain.Attempt, error) {
			t.Fatal("not used")
			return nil, nil
		},
		getMyStatsFn: func(context.Context, string) (domain.Stats, error) {
			t.Fatal("未認証の場合、repo は呼ばれない想定です")
			return domain.Stats{}, nil
		},
		createAttemptFn: func(context.Context, string, string, string, bool) (string, error) {
			t.Fatal("not used")
			return "", nil
		},
	})

	_, err := u.GetMyStats(context.Background(), "")
	if !apperror.IsCode(err, apperror.CodeUnauthenticated) {
		t.Fatalf("UNAUTHENTICATED を期待しました: err=%v", err)
	}
}

func TestUsecase_GetMyStats_Success(t *testing.T) {
	t.Parallel()

	userID := mustUUID(t)
	expected := domain.Stats{TotalAttempts: 10, CorrectAttempts: 7, Accuracy: 0.7}

	u := NewUsecase(&fakeAttemptRepo{
		listMyAttemptsFn: func(context.Context, string, int32) ([]domain.Attempt, error) {
			t.Fatal("not used")
			return nil, nil
		},
		getMyStatsFn: func(context.Context, string) (domain.Stats, error) {
			return expected, nil
		},
		createAttemptFn: func(context.Context, string, string, string, bool) (string, error) {
			t.Fatal("not used")
			return "", nil
		},
	})

	got, err := u.GetMyStats(context.Background(), userID)
	if err != nil {
		t.Fatalf("err should be nil: %v", err)
	}
	if got != expected {
		t.Fatalf("result mismatch: got=%+v expected=%+v", got, expected)
	}
}
