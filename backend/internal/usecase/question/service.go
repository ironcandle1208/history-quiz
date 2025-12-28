package question

import (
	"context"
	"strings"

	"github.com/google/uuid"
	"github.com/history-quiz/historyquiz/internal/domain"
	"github.com/history-quiz/historyquiz/internal/domain/apperror"
	"github.com/history-quiz/historyquiz/internal/repository"
)

// Usecase は Question のユースケース（作成/更新/取得/一覧）を提供する。
type Usecase struct {
	questionRepo repository.QuestionRepository
	userRepo     repository.UserRepository
}

// NewUsecase は QuestionUsecase を生成する。
func NewUsecase(questionRepo repository.QuestionRepository, userRepo repository.UserRepository) *Usecase {
	return &Usecase{
		questionRepo: questionRepo,
		userRepo:     userRepo,
	}
}

// CreateQuestion は問題を作成して詳細を返す。
func (u *Usecase) CreateQuestion(ctx context.Context, userID string, draft domain.QuestionDraft) (domain.QuestionDetail, error) {
	if userID == "" {
		return domain.QuestionDetail{}, apperror.Unauthenticated("認証が必要です")
	}
	if err := validateDraft(draft); err != nil {
		return domain.QuestionDetail{}, err
	}
	if err := u.userRepo.EnsureUserExists(ctx, userID); err != nil {
		return domain.QuestionDetail{}, err
	}
	return u.questionRepo.CreateQuestion(ctx, userID, draft)
}

// UpdateQuestion は問題を更新して詳細を返す（所有者チェック含む）。
func (u *Usecase) UpdateQuestion(ctx context.Context, userID string, questionID string, draft domain.QuestionDraft) (domain.QuestionDetail, error) {
	if userID == "" {
		return domain.QuestionDetail{}, apperror.Unauthenticated("認証が必要です")
	}
	if questionID == "" {
		return domain.QuestionDetail{}, apperror.InvalidArgument("question_id が空です", apperror.FieldViolation{Field: "question_id", Description: "必須です"})
	}
	if _, err := uuid.Parse(questionID); err != nil {
		return domain.QuestionDetail{}, apperror.InvalidArgument("question_id が不正です", apperror.FieldViolation{Field: "question_id", Description: "UUID 形式で指定してください"})
	}
	if err := validateDraft(draft); err != nil {
		return domain.QuestionDetail{}, err
	}

	authorUserID, deleted, err := u.questionRepo.GetQuestionAuthor(ctx, questionID)
	if err != nil {
		return domain.QuestionDetail{}, err
	}
	if deleted {
		return domain.QuestionDetail{}, apperror.NotFound("問題が見つかりません")
	}
	if authorUserID != userID {
		return domain.QuestionDetail{}, apperror.PermissionDenied("権限がありません")
	}

	// 更新時も users が存在する前提に揃える（外部キーの一貫性）。
	if err := u.userRepo.EnsureUserExists(ctx, userID); err != nil {
		return domain.QuestionDetail{}, err
	}

	return u.questionRepo.UpdateQuestion(ctx, userID, questionID, draft)
}

// GetMyQuestion は自分の問題の詳細を返す（論理削除は除外）。
func (u *Usecase) GetMyQuestion(ctx context.Context, userID string, questionID string) (domain.QuestionDetail, error) {
	if userID == "" {
		return domain.QuestionDetail{}, apperror.Unauthenticated("認証が必要です")
	}
	if questionID == "" {
		return domain.QuestionDetail{}, apperror.InvalidArgument("question_id が空です", apperror.FieldViolation{Field: "question_id", Description: "必須です"})
	}
	if _, err := uuid.Parse(questionID); err != nil {
		return domain.QuestionDetail{}, apperror.InvalidArgument("question_id が不正です", apperror.FieldViolation{Field: "question_id", Description: "UUID 形式で指定してください"})
	}
	return u.questionRepo.GetMyQuestion(ctx, userID, questionID)
}

// ListMyQuestions は自分の問題一覧を返す（論理削除は除外）。
func (u *Usecase) ListMyQuestions(ctx context.Context, userID string, pageSize int32) ([]domain.QuestionSummary, string, error) {
	if userID == "" {
		return nil, "", apperror.Unauthenticated("認証が必要です")
	}

	limit := normalizePageSize(pageSize)
	questions, err := u.questionRepo.ListMyQuestions(ctx, userID, limit)
	if err != nil {
		return nil, "", err
	}

	// Phase1 では page_token を未実装（next_page_token は空）。
	return questions, "", nil
}

// validateDraft は作問入力のバリデーションを行う。
func validateDraft(draft domain.QuestionDraft) error {
	var violations []apperror.FieldViolation

	if strings.TrimSpace(draft.Prompt) == "" {
		violations = append(violations, apperror.FieldViolation{Field: "draft.prompt", Description: "必須です"})
	}

	if len(draft.Choices) != 4 {
		violations = append(violations, apperror.FieldViolation{Field: "draft.choices", Description: "選択肢は4件である必要があります"})
	} else {
		for i, c := range draft.Choices {
			if strings.TrimSpace(c) == "" {
				violations = append(violations, apperror.FieldViolation{Field: "draft.choices[" + itoa(i) + "]", Description: "必須です"})
			}
		}
	}

	if draft.CorrectOrdinal < 0 || draft.CorrectOrdinal > 3 {
		violations = append(violations, apperror.FieldViolation{Field: "draft.correct_ordinal", Description: "0..3 の範囲で指定してください"})
	}

	if len(violations) > 0 {
		return apperror.InvalidArgument("入力が不正です", violations...)
	}
	return nil
}

// normalizePageSize は pageSize のデフォルト/上限を統一する。
func normalizePageSize(pageSize int32) int32 {
	if pageSize <= 0 {
		return 20
	}
	if pageSize > 100 {
		return 100
	}
	return pageSize
}

func itoa(i int) string {
	// strconv.Itoa を避けたいわけではないが、依存先を最小にするために簡易実装にする。
	// NOTE: ここで扱う i は choices の index（0..3）想定。
	switch i {
	case 0:
		return "0"
	case 1:
		return "1"
	case 2:
		return "2"
	case 3:
		return "3"
	default:
		return "?"
	}
}

