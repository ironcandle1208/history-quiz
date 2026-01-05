package question

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/history-quiz/historyquiz/internal/domain"
	"github.com/history-quiz/historyquiz/internal/domain/apperror"
)

// fakeQuestionRepo は question.Usecase のユニットテスト用のリポジトリ差し替え。
// NOTE: 実装は関数フィールドで差し替え、各テストで「呼ばれてよい/よくない」を明示する。
type fakeQuestionRepo struct {
	createQuestionFn    func(ctx context.Context, authorUserID string, draft domain.QuestionDraft) (domain.QuestionDetail, error)
	updateQuestionFn    func(ctx context.Context, userID string, questionID string, draft domain.QuestionDraft) (domain.QuestionDetail, error)
	getMyQuestionFn     func(ctx context.Context, userID string, questionID string) (domain.QuestionDetail, error)
	listMyQuestionsFn   func(ctx context.Context, userID string, limit int32) ([]domain.QuestionSummary, error)
	getQuestionAuthorFn func(ctx context.Context, questionID string) (authorUserID string, deleted bool, err error)
}

func (f *fakeQuestionRepo) CreateQuestion(ctx context.Context, authorUserID string, draft domain.QuestionDraft) (domain.QuestionDetail, error) {
	return f.createQuestionFn(ctx, authorUserID, draft)
}
func (f *fakeQuestionRepo) UpdateQuestion(ctx context.Context, userID string, questionID string, draft domain.QuestionDraft) (domain.QuestionDetail, error) {
	return f.updateQuestionFn(ctx, userID, questionID, draft)
}
func (f *fakeQuestionRepo) GetMyQuestion(ctx context.Context, userID string, questionID string) (domain.QuestionDetail, error) {
	return f.getMyQuestionFn(ctx, userID, questionID)
}
func (f *fakeQuestionRepo) ListMyQuestions(ctx context.Context, userID string, limit int32) ([]domain.QuestionSummary, error) {
	return f.listMyQuestionsFn(ctx, userID, limit)
}
func (f *fakeQuestionRepo) GetQuestionAuthor(ctx context.Context, questionID string) (string, bool, error) {
	return f.getQuestionAuthorFn(ctx, questionID)
}

// quiz 側でしか使わないメソッドは、誤って呼ばれたらテストを落とす。
func (*fakeQuestionRepo) ListQuizCandidateQuestionIDs(context.Context, string) ([]string, error) {
	panic("not used in question usecase tests")
}
func (*fakeQuestionRepo) ListQuizCandidateSystemQuestionIDs(context.Context, string) ([]string, error) {
	panic("not used in question usecase tests")
}
func (*fakeQuestionRepo) ListQuizCandidateNonSystemQuestionIDs(context.Context, string) ([]string, error) {
	panic("not used in question usecase tests")
}
func (*fakeQuestionRepo) GetQuizQuestion(context.Context, string) (domain.Question, error) {
	panic("not used in question usecase tests")
}
func (*fakeQuestionRepo) GetCorrectChoiceID(context.Context, string) (string, error) {
	panic("not used in question usecase tests")
}
func (*fakeQuestionRepo) ChoiceBelongsToQuestion(context.Context, string, string) (bool, error) {
	panic("not used in question usecase tests")
}

type fakeUserRepo struct {
	ensureUserExistsFn func(ctx context.Context, userID string) error
}

func (f *fakeUserRepo) EnsureUserExists(ctx context.Context, userID string) error {
	return f.ensureUserExistsFn(ctx, userID)
}

// mustUUID はテストで UUID を生成するヘルパー。
func mustUUID(t *testing.T) string {
	t.Helper()
	return uuid.NewString()
}

func TestUsecase_CreateQuestion_Unauthenticated(t *testing.T) {
	t.Parallel()

	u := NewUsecase(
		&fakeQuestionRepo{
			createQuestionFn: func(context.Context, string, domain.QuestionDraft) (domain.QuestionDetail, error) {
				t.Fatal("未認証の場合、repo は呼ばれない想定です")
				return domain.QuestionDetail{}, nil
			},
		},
		&fakeUserRepo{ensureUserExistsFn: func(context.Context, string) error {
			t.Fatal("未認証の場合、EnsureUserExists は呼ばれない想定です")
			return nil
		}},
	)

	_, err := u.CreateQuestion(context.Background(), "", domain.QuestionDraft{})
	if !apperror.IsCode(err, apperror.CodeUnauthenticated) {
		t.Fatalf("UNAUTHENTICATED を期待しました: err=%v", err)
	}
}

func TestUsecase_CreateQuestion_InvalidDraft(t *testing.T) {
	t.Parallel()

	u := NewUsecase(
		&fakeQuestionRepo{
			createQuestionFn: func(context.Context, string, domain.QuestionDraft) (domain.QuestionDetail, error) {
				t.Fatal("入力不正の場合、repo は呼ばれない想定です")
				return domain.QuestionDetail{}, nil
			},
		},
		&fakeUserRepo{ensureUserExistsFn: func(context.Context, string) error {
			t.Fatal("入力不正の場合、EnsureUserExists は呼ばれない想定です")
			return nil
		}},
	)

	_, err := u.CreateQuestion(context.Background(), mustUUID(t), domain.QuestionDraft{
		Prompt:         "  ",
		Choices:        []string{"a", "b"},
		CorrectOrdinal: 10,
	})
	if !apperror.IsCode(err, apperror.CodeInvalidArgument) {
		t.Fatalf("INVALID_ARGUMENT を期待しました: err=%v", err)
	}
}

func TestUsecase_CreateQuestion_Success(t *testing.T) {
	t.Parallel()

	userID := mustUUID(t)
	draft := domain.QuestionDraft{
		Prompt:         "Q",
		Choices:        []string{"a", "b", "c", "d"},
		CorrectOrdinal: 2,
		Explanation:    "E",
	}

	ensureCalled := 0
	createCalled := 0

	expected := domain.QuestionDetail{
		ID:        mustUUID(t),
		Prompt:     "Q",
		Choices:    []domain.Choice{{ID: mustUUID(t), Label: "a", Ordinal: 0}},
		UpdatedAt:  time.Unix(0, 0),
		Explanation: "E",
	}

	u := NewUsecase(
		&fakeQuestionRepo{
			createQuestionFn: func(ctx context.Context, gotUserID string, gotDraft domain.QuestionDraft) (domain.QuestionDetail, error) {
					createCalled++
					if gotUserID != userID {
						t.Fatalf("CreateQuestion の userID が一致しません: got=%s want=%s", gotUserID, userID)
					}
					if gotDraft.Prompt != draft.Prompt || len(gotDraft.Choices) != 4 || gotDraft.CorrectOrdinal != 2 {
						t.Fatalf("CreateQuestion の draft が期待と異なります: got=%+v", gotDraft)
					}
					return expected, nil
				},
			},
			&fakeUserRepo{ensureUserExistsFn: func(ctx context.Context, gotUserID string) error {
				ensureCalled++
				if gotUserID != userID {
					t.Fatalf("EnsureUserExists の userID が一致しません: got=%s want=%s", gotUserID, userID)
				}
				return nil
			}},
		)

		got, err := u.CreateQuestion(context.Background(), userID, draft)
		if err != nil {
			t.Fatalf("err は nil を期待しました: %v", err)
		}
		if got.ID != expected.ID {
			t.Fatalf("結果が期待と異なります: got=%+v expected=%+v", got, expected)
		}
		if ensureCalled != 1 || createCalled != 1 {
			t.Fatalf("EnsureUserExists=1/CreateQuestion=1 を期待: ensure=%d create=%d", ensureCalled, createCalled)
		}
}

func TestUsecase_UpdateQuestion_PermissionDenied(t *testing.T) {
	t.Parallel()

	userID := mustUUID(t)
	questionID := mustUUID(t)
	authorUserID := mustUUID(t)

	u := NewUsecase(
		&fakeQuestionRepo{
			getQuestionAuthorFn: func(context.Context, string) (string, bool, error) {
				return authorUserID, false, nil
			},
			updateQuestionFn: func(context.Context, string, string, domain.QuestionDraft) (domain.QuestionDetail, error) {
				t.Fatal("権限がない場合、UpdateQuestion は呼ばれない想定です")
				return domain.QuestionDetail{}, nil
			},
		},
		&fakeUserRepo{ensureUserExistsFn: func(context.Context, string) error {
			t.Fatal("権限がない場合、EnsureUserExists は呼ばれない想定です")
			return nil
		}},
	)

	_, err := u.UpdateQuestion(context.Background(), userID, questionID, domain.QuestionDraft{
		Prompt:         "Q",
		Choices:        []string{"a", "b", "c", "d"},
		CorrectOrdinal: 0,
	})
	if !apperror.IsCode(err, apperror.CodePermissionDenied) {
		t.Fatalf("PERMISSION_DENIED を期待しました: err=%v", err)
	}
}

func TestUsecase_UpdateQuestion_DeletedIsNotFound(t *testing.T) {
	t.Parallel()

	userID := mustUUID(t)
	questionID := mustUUID(t)

	u := NewUsecase(
		&fakeQuestionRepo{
			getQuestionAuthorFn: func(context.Context, string) (string, bool, error) {
				return userID, true, nil
			},
			updateQuestionFn: func(context.Context, string, string, domain.QuestionDraft) (domain.QuestionDetail, error) {
				t.Fatal("deleted の場合、UpdateQuestion は呼ばれない想定です")
				return domain.QuestionDetail{}, nil
			},
		},
		&fakeUserRepo{ensureUserExistsFn: func(context.Context, string) error {
			t.Fatal("deleted の場合、EnsureUserExists は呼ばれない想定です")
			return nil
		}},
	)

	_, err := u.UpdateQuestion(context.Background(), userID, questionID, domain.QuestionDraft{
		Prompt:         "Q",
		Choices:        []string{"a", "b", "c", "d"},
		CorrectOrdinal: 0,
	})
	if !apperror.IsCode(err, apperror.CodeNotFound) {
		t.Fatalf("NOT_FOUND を期待しました: err=%v", err)
	}
}

func TestUsecase_UpdateQuestion_Success(t *testing.T) {
	t.Parallel()

	userID := mustUUID(t)
	questionID := mustUUID(t)
	draft := domain.QuestionDraft{
		Prompt:         "Q",
		Choices:        []string{"a", "b", "c", "d"},
		CorrectOrdinal: 1,
		Explanation:    "E",
	}

	ensureCalled := 0
	updateCalled := 0

	expected := domain.QuestionDetail{ID: questionID, Prompt: "Q", UpdatedAt: time.Unix(0, 0)}

	u := NewUsecase(
		&fakeQuestionRepo{
			getQuestionAuthorFn: func(context.Context, string) (string, bool, error) {
				return userID, false, nil
			},
			updateQuestionFn: func(ctx context.Context, gotUserID string, gotQuestionID string, gotDraft domain.QuestionDraft) (domain.QuestionDetail, error) {
				updateCalled++
				if gotUserID != userID || gotQuestionID != questionID {
					t.Fatalf("UpdateQuestion の引数が期待と異なります: user=%s q=%s", gotUserID, gotQuestionID)
				}
				if gotDraft.CorrectOrdinal != 1 {
					t.Fatalf("UpdateQuestion の draft が期待と異なります: %+v", gotDraft)
				}
				return expected, nil
			},
		},
		&fakeUserRepo{ensureUserExistsFn: func(ctx context.Context, gotUserID string) error {
			ensureCalled++
			if gotUserID != userID {
				t.Fatalf("EnsureUserExists の userID が一致しません: got=%s want=%s", gotUserID, userID)
			}
			return nil
		}},
	)

	got, err := u.UpdateQuestion(context.Background(), userID, questionID, draft)
	if err != nil {
		t.Fatalf("err は nil を期待しました: %v", err)
	}
	if got.ID != expected.ID {
		t.Fatalf("結果が期待と異なります: got=%+v expected=%+v", got, expected)
	}
	if ensureCalled != 1 || updateCalled != 1 {
		t.Fatalf("EnsureUserExists=1/UpdateQuestion=1 を期待: ensure=%d update=%d", ensureCalled, updateCalled)
	}
}

func TestUsecase_ListMyQuestions_NormalizesPageSize(t *testing.T) {
	t.Parallel()

	userID := mustUUID(t)
	gotLimit := int32(-1)

	u := NewUsecase(
		&fakeQuestionRepo{
			listMyQuestionsFn: func(ctx context.Context, gotUserID string, limit int32) ([]domain.QuestionSummary, error) {
				if gotUserID != userID {
					t.Fatalf("ListMyQuestions の userID が一致しません: got=%s want=%s", gotUserID, userID)
				}
				gotLimit = limit
				return nil, nil
			},
		},
		&fakeUserRepo{ensureUserExistsFn: func(context.Context, string) error { return nil }},
	)

	_, _, err := u.ListMyQuestions(context.Background(), userID, 0)
	if err != nil {
		t.Fatalf("err は nil を期待しました: %v", err)
	}
	if gotLimit != 20 {
		t.Fatalf("pageSize<=0 は 20 を期待: got=%d", gotLimit)
	}

	gotLimit = -1
	_, _, err = u.ListMyQuestions(context.Background(), userID, 999)
	if err != nil {
		t.Fatalf("err は nil を期待しました: %v", err)
	}
	if gotLimit != 100 {
		t.Fatalf("pageSize>100 は 100 を期待: got=%d", gotLimit)
	}
}
