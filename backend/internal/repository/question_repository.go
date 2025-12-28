package repository

import (
	"context"

	"github.com/history-quiz/historyquiz/internal/domain"
)

// QuestionRepository は questions/choices/answer_keys の永続化を抽象化する。
type QuestionRepository interface {
	ListQuizCandidateQuestionIDs(ctx context.Context, previousQuestionID string) (ids []string, err error)
	ListQuizCandidateSystemQuestionIDs(ctx context.Context, previousQuestionID string) (ids []string, err error)
	ListQuizCandidateNonSystemQuestionIDs(ctx context.Context, previousQuestionID string) (ids []string, err error)
	GetQuizQuestion(ctx context.Context, questionID string) (domain.Question, error)
	GetCorrectChoiceID(ctx context.Context, questionID string) (correctChoiceID string, err error)
	ChoiceBelongsToQuestion(ctx context.Context, questionID string, choiceID string) (bool, error)

	CreateQuestion(ctx context.Context, authorUserID string, draft domain.QuestionDraft) (domain.QuestionDetail, error)
	UpdateQuestion(ctx context.Context, userID string, questionID string, draft domain.QuestionDraft) (domain.QuestionDetail, error)
	GetMyQuestion(ctx context.Context, userID string, questionID string) (domain.QuestionDetail, error)
	ListMyQuestions(ctx context.Context, userID string, limit int32) ([]domain.QuestionSummary, error)

	// GetQuestionAuthor は所有者チェックのために作成者を返す（deleted_at も含めて取得する）。
	GetQuestionAuthor(ctx context.Context, questionID string) (authorUserID string, deleted bool, err error)
}

