package quiz

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/history-quiz/historyquiz/internal/domain"
	"github.com/history-quiz/historyquiz/internal/domain/apperror"
)

// fakeQuizQuestionRepo は quiz.Usecase のテスト用に、QuestionRepository の必要メソッドだけを差し替える。
// NOTE: テストごとに挙動を作り込みたいので、関数フィールドで実装する。
type fakeQuizQuestionRepo struct {
	listCandidateQuestionIDsFn        func(ctx context.Context, previousQuestionID string) ([]string, error)
	listCandidateSystemQuestionIDsFn  func(ctx context.Context, previousQuestionID string) ([]string, error)
	listCandidateNonSystemQuestionIDs func(ctx context.Context, previousQuestionID string) ([]string, error)
	getQuizQuestionFn                 func(ctx context.Context, questionID string) (domain.Question, error)
	getCorrectChoiceIDFn              func(ctx context.Context, questionID string) (string, error)
	choiceBelongsToQuestionFn         func(ctx context.Context, questionID string, choiceID string) (bool, error)
}

func (f *fakeQuizQuestionRepo) ListQuizCandidateQuestionIDs(ctx context.Context, previousQuestionID string) ([]string, error) {
	return f.listCandidateQuestionIDsFn(ctx, previousQuestionID)
}
func (f *fakeQuizQuestionRepo) ListQuizCandidateSystemQuestionIDs(ctx context.Context, previousQuestionID string) ([]string, error) {
	return f.listCandidateSystemQuestionIDsFn(ctx, previousQuestionID)
}
func (f *fakeQuizQuestionRepo) ListQuizCandidateNonSystemQuestionIDs(ctx context.Context, previousQuestionID string) ([]string, error) {
	return f.listCandidateNonSystemQuestionIDs(ctx, previousQuestionID)
}
func (f *fakeQuizQuestionRepo) GetQuizQuestion(ctx context.Context, questionID string) (domain.Question, error) {
	return f.getQuizQuestionFn(ctx, questionID)
}
func (f *fakeQuizQuestionRepo) GetCorrectChoiceID(ctx context.Context, questionID string) (string, error) {
	return f.getCorrectChoiceIDFn(ctx, questionID)
}
func (f *fakeQuizQuestionRepo) ChoiceBelongsToQuestion(ctx context.Context, questionID string, choiceID string) (bool, error) {
	return f.choiceBelongsToQuestionFn(ctx, questionID, choiceID)
}

// 以降の QuestionRepository メソッドは quiz.Usecase のテストでは不要のため、panic させる。
// NOTE: テストが意図せず別メソッドに依存した場合に、早期に気付けるようにする。
func (*fakeQuizQuestionRepo) CreateQuestion(context.Context, string, domain.QuestionDraft) (domain.QuestionDetail, error) {
	panic("not used in quiz usecase tests")
}
func (*fakeQuizQuestionRepo) UpdateQuestion(context.Context, string, string, domain.QuestionDraft) (domain.QuestionDetail, error) {
	panic("not used in quiz usecase tests")
}
func (*fakeQuizQuestionRepo) GetMyQuestion(context.Context, string, string) (domain.QuestionDetail, error) {
	panic("not used in quiz usecase tests")
}
func (*fakeQuizQuestionRepo) ListMyQuestions(context.Context, string, int32) ([]domain.QuestionSummary, error) {
	panic("not used in quiz usecase tests")
}
func (*fakeQuizQuestionRepo) GetQuestionAuthor(context.Context, string) (string, bool, error) {
	panic("not used in quiz usecase tests")
}

type fakeAttemptRepo struct {
	createAttemptFn func(ctx context.Context, userID, questionID, selectedChoiceID string, isCorrect bool) (string, error)
}

func (f *fakeAttemptRepo) CreateAttempt(ctx context.Context, userID string, questionID string, selectedChoiceID string, isCorrect bool) (string, error) {
	return f.createAttemptFn(ctx, userID, questionID, selectedChoiceID, isCorrect)
}
func (*fakeAttemptRepo) ListMyAttempts(context.Context, string, int32) ([]domain.Attempt, error) {
	panic("not used in quiz usecase tests")
}
func (*fakeAttemptRepo) GetMyStats(context.Context, string) (domain.Stats, error) {
	panic("not used in quiz usecase tests")
}

type fakeUserRepo struct {
	ensureUserExistsFn func(ctx context.Context, userID string) error
}

func (f *fakeUserRepo) EnsureUserExists(ctx context.Context, userID string) error {
	return f.ensureUserExistsFn(ctx, userID)
}

// mustUUID はテストで UUID を安定的に生成する。
func mustUUID(t *testing.T) string {
	t.Helper()
	return uuid.NewString()
}

func TestUsecase_GetQuestion_InvalidPreviousQuestionID(t *testing.T) {
	t.Parallel()

	u := NewUsecase(
		&fakeQuizQuestionRepo{
			listCandidateNonSystemQuestionIDs: func(context.Context, string) ([]string, error) {
				t.Fatal("previous_question_id が不正な場合、repo は呼ばれない想定です")
				return nil, nil
			},
		},
		&fakeAttemptRepo{createAttemptFn: func(context.Context, string, string, string, bool) (string, error) {
			t.Fatal("not used")
			return "", nil
		}},
		&fakeUserRepo{ensureUserExistsFn: func(context.Context, string) error {
			t.Fatal("not used")
			return nil
		}},
	)

	_, err := u.GetQuestion(context.Background(), "req-1", "not-a-uuid")
	if !apperror.IsCode(err, apperror.CodeInvalidArgument) {
		t.Fatalf("INVALID_ARGUMENT を期待しました: err=%v", err)
	}
}

func TestUsecase_GetQuestion_FallbackToDefaultWhenDBEmpty(t *testing.T) {
	t.Parallel()

	u := NewUsecase(
		&fakeQuizQuestionRepo{
			listCandidateNonSystemQuestionIDs: func(context.Context, string) ([]string, error) {
				// ユーザー作成問題が0件という前提（DBが空、または system のみ）。
				return nil, nil
			},
			listCandidateSystemQuestionIDsFn: func(context.Context, string) ([]string, error) {
				// system 候補も空 → 既定問題へフォールバック。
				return nil, nil
			},
			listCandidateQuestionIDsFn: func(context.Context, string) ([]string, error) {
				t.Fatal("nonSystemIDs が空の場合は system の候補を使う想定です")
				return nil, nil
			},
			getQuizQuestionFn: func(context.Context, string) (domain.Question, error) {
				t.Fatal("候補が空の場合、GetQuizQuestion は呼ばれない想定です")
				return domain.Question{}, nil
			},
		},
		&fakeAttemptRepo{createAttemptFn: func(context.Context, string, string, string, bool) (string, error) {
			t.Fatal("not used")
			return "", nil
		}},
		&fakeUserRepo{ensureUserExistsFn: func(context.Context, string) error {
			t.Fatal("not used")
			return nil
		}},
	)

	q, err := u.GetQuestion(context.Background(), "req-1", "")
	if err != nil {
		t.Fatalf("err should be nil: %v", err)
	}
	if q.ID == "" {
		t.Fatalf("既定問題が返る想定です")
	}
}

func TestUsecase_GetQuestion_ExcludePreviousButGuaranteeOne(t *testing.T) {
	t.Parallel()

	previousID := mustUUID(t)
	onlyOneID := mustUUID(t)

	listCall := 0
	u := NewUsecase(
		&fakeQuizQuestionRepo{
			listCandidateNonSystemQuestionIDs: func(context.Context, string) ([]string, error) {
				// 「ユーザー作成問題がある」扱いにして、全体候補を使う分岐へ。
				return []string{onlyOneID}, nil
			},
			listCandidateQuestionIDsFn: func(ctx context.Context, prev string) ([]string, error) {
				listCall++
				// 1回目は previous を除外した結果が空、2回目は除外解除で1件返す想定。
				if prev != "" {
					return nil, nil
				}
				return []string{onlyOneID}, nil
			},
			listCandidateSystemQuestionIDsFn: func(context.Context, string) ([]string, error) {
				t.Fatal("nonSystemIDs が空でない場合は system 候補を使わない想定です")
				return nil, nil
			},
			getQuizQuestionFn: func(context.Context, string) (domain.Question, error) {
				return domain.Question{ID: onlyOneID, Prompt: "p", Choices: []domain.Choice{}}, nil
			},
		},
		&fakeAttemptRepo{createAttemptFn: func(context.Context, string, string, string, bool) (string, error) {
			t.Fatal("not used")
			return "", nil
		}},
		&fakeUserRepo{ensureUserExistsFn: func(context.Context, string) error {
			t.Fatal("not used")
			return nil
		}},
	)

	q, err := u.GetQuestion(context.Background(), "req-1", previousID)
	if err != nil {
		t.Fatalf("err should be nil: %v", err)
	}
	if q.ID != onlyOneID {
		t.Fatalf("q.ID should be selected: got=%s want=%s", q.ID, onlyOneID)
	}
	if listCall != 2 {
		t.Fatalf("候補取得は previous 除外→解除の2回を期待: got=%d", listCall)
	}
}

func TestUsecase_GetQuestion_FallbackToDefaultWhenSelectedNotFound(t *testing.T) {
	t.Parallel()

	selectedID := mustUUID(t)

	u := NewUsecase(
		&fakeQuizQuestionRepo{
			listCandidateNonSystemQuestionIDs: func(context.Context, string) ([]string, error) { return []string{selectedID}, nil },
			listCandidateQuestionIDsFn:        func(context.Context, string) ([]string, error) { return []string{selectedID}, nil },
			listCandidateSystemQuestionIDsFn:  func(context.Context, string) ([]string, error) { return nil, nil },
			getQuizQuestionFn: func(context.Context, string) (domain.Question, error) {
				// 整合性が崩れている想定 → 既定問題へフォールバック。
				return domain.Question{}, apperror.NotFound("missing")
			},
		},
		&fakeAttemptRepo{createAttemptFn: func(context.Context, string, string, string, bool) (string, error) {
			t.Fatal("not used")
			return "", nil
		}},
		&fakeUserRepo{ensureUserExistsFn: func(context.Context, string) error {
			t.Fatal("not used")
			return nil
		}},
	)

	q, err := u.GetQuestion(context.Background(), "req-1", "")
	if err != nil {
		t.Fatalf("err should be nil: %v", err)
	}
	if q.ID == selectedID {
		t.Fatalf("not found の場合は既定問題へフォールバックする想定です")
	}
	if q.ID == "" {
		t.Fatalf("既定問題が返る想定です")
	}
}

func TestUsecase_SubmitAnswer_SavesAttemptWhenLoggedIn(t *testing.T) {
	t.Parallel()

	userID := mustUUID(t)
	questionID := mustUUID(t)
	correctChoiceID := mustUUID(t)

	ensureCalled := 0
	createCalled := 0

	u := NewUsecase(
		&fakeQuizQuestionRepo{
			getCorrectChoiceIDFn: func(context.Context, string) (string, error) { return correctChoiceID, nil },
			choiceBelongsToQuestionFn: func(context.Context, string, string) (bool, error) {
				return true, nil
			},
			listCandidateNonSystemQuestionIDs: func(context.Context, string) ([]string, error) { return nil, nil },
			listCandidateQuestionIDsFn:        func(context.Context, string) ([]string, error) { return nil, nil },
			listCandidateSystemQuestionIDsFn:  func(context.Context, string) ([]string, error) { return nil, nil },
			getQuizQuestionFn:                 func(context.Context, string) (domain.Question, error) { return domain.Question{}, nil },
		},
		&fakeAttemptRepo{createAttemptFn: func(ctx context.Context, gotUserID, gotQuestionID, gotSelectedChoiceID string, isCorrect bool) (string, error) {
			createCalled++
			if gotUserID != userID || gotQuestionID != questionID || gotSelectedChoiceID != correctChoiceID {
				t.Fatalf("CreateAttempt args mismatch: user=%s q=%s choice=%s", gotUserID, gotQuestionID, gotSelectedChoiceID)
			}
			if !isCorrect {
				t.Fatalf("correct choice なので isCorrect=true を期待")
			}
			return "attempt-1", nil
		}},
		&fakeUserRepo{ensureUserExistsFn: func(ctx context.Context, gotUserID string) error {
			ensureCalled++
			if gotUserID != userID {
				t.Fatalf("EnsureUserExists args mismatch: got=%s want=%s", gotUserID, userID)
			}
			return nil
		}},
	)

	res, err := u.SubmitAnswer(context.Background(), userID, questionID, correctChoiceID)
	if err != nil {
		t.Fatalf("err should be nil: %v", err)
	}
	if !res.IsCorrect || res.CorrectChoiceID != correctChoiceID || res.AttemptID != "attempt-1" {
		t.Fatalf("result mismatch: %+v", res)
	}
	if ensureCalled != 1 || createCalled != 1 {
		t.Fatalf("EnsureUserExists=1/CreateAttempt=1 を期待: ensure=%d create=%d", ensureCalled, createCalled)
	}
}

func TestUsecase_SubmitAnswer_DefaultQuestion_DoesNotCreateAttemptEvenWhenLoggedIn(t *testing.T) {
	t.Parallel()

	userID := mustUUID(t)

	// defaultQuestions の1問を使う（DBが空のケース）。
	questionID := defaultQuestions[0].ID
	correctChoiceID := defaultCorrectChoiceIDByQuestionID[questionID]

	createCalled := 0

	u := NewUsecase(
		&fakeQuizQuestionRepo{
			getCorrectChoiceIDFn: func(context.Context, string) (string, error) {
				// DB 側が見つからない → 既定セットにフォールバック。
				return "", apperror.NotFound("not found")
			},
			choiceBelongsToQuestionFn: func(context.Context, string, string) (bool, error) {
				t.Fatal("default の場合は ChoiceBelongsToQuestion を呼ばない想定です")
				return false, nil
			},
			listCandidateNonSystemQuestionIDs: func(context.Context, string) ([]string, error) { return nil, nil },
			listCandidateQuestionIDsFn:        func(context.Context, string) ([]string, error) { return nil, nil },
			listCandidateSystemQuestionIDsFn:  func(context.Context, string) ([]string, error) { return nil, nil },
			getQuizQuestionFn:                 func(context.Context, string) (domain.Question, error) { return domain.Question{}, nil },
		},
		&fakeAttemptRepo{createAttemptFn: func(context.Context, string, string, string, bool) (string, error) {
			createCalled++
			return "", nil
		}},
		&fakeUserRepo{ensureUserExistsFn: func(context.Context, string) error {
			t.Fatal("default の場合は EnsureUserExists を呼ばない（attempt を作らない）想定です")
			return nil
		}},
	)

	res, err := u.SubmitAnswer(context.Background(), userID, questionID, correctChoiceID)
	if err != nil {
		t.Fatalf("err should be nil: %v", err)
	}
	if !res.IsCorrect || res.CorrectChoiceID != correctChoiceID || res.AttemptID != "" {
		t.Fatalf("result mismatch: %+v", res)
	}
	if createCalled != 0 {
		t.Fatalf("default の場合は attempt を作らない想定です: called=%d", createCalled)
	}
}

func TestUsecase_SubmitAnswer_InvalidChoiceRelation(t *testing.T) {
	t.Parallel()

	questionID := mustUUID(t)
	choiceID := mustUUID(t)

	u := NewUsecase(
		&fakeQuizQuestionRepo{
			getCorrectChoiceIDFn: func(context.Context, string) (string, error) { return mustUUID(t), nil },
			choiceBelongsToQuestionFn: func(context.Context, string, string) (bool, error) {
				return false, nil
			},
			listCandidateNonSystemQuestionIDs: func(context.Context, string) ([]string, error) { return nil, nil },
			listCandidateQuestionIDsFn:        func(context.Context, string) ([]string, error) { return nil, nil },
			listCandidateSystemQuestionIDsFn:  func(context.Context, string) ([]string, error) { return nil, nil },
			getQuizQuestionFn:                 func(context.Context, string) (domain.Question, error) { return domain.Question{}, nil },
		},
		&fakeAttemptRepo{createAttemptFn: func(context.Context, string, string, string, bool) (string, error) {
			t.Fatal("not used")
			return "", nil
		}},
		&fakeUserRepo{ensureUserExistsFn: func(context.Context, string) error {
			t.Fatal("not used")
			return nil
		}},
	)

	_, err := u.SubmitAnswer(context.Background(), "", questionID, choiceID)
	if !apperror.IsCode(err, apperror.CodeInvalidArgument) {
		t.Fatalf("INVALID_ARGUMENT を期待しました: err=%v", err)
	}
}

