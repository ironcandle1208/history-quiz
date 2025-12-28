package quiz

import (
	"context"
	"crypto/sha256"
	"encoding/binary"

	"github.com/google/uuid"
	"github.com/history-quiz/historyquiz/internal/domain"
	"github.com/history-quiz/historyquiz/internal/domain/apperror"
	"github.com/history-quiz/historyquiz/internal/repository"
)

// Usecase は Quiz のユースケース（出題/判定）を提供する。
// transport（gRPC）は入力の受け渡しとエラー変換に集中し、ビジネスルールはここに集約する。
type Usecase struct {
	questionRepo repository.QuestionRepository
	attemptRepo  repository.AttemptRepository
	userRepo     repository.UserRepository
}

// NewUsecase は QuizUsecase を生成する。
func NewUsecase(questionRepo repository.QuestionRepository, attemptRepo repository.AttemptRepository, userRepo repository.UserRepository) *Usecase {
	return &Usecase{
		questionRepo: questionRepo,
		attemptRepo:  attemptRepo,
		userRepo:     userRepo,
	}
}

// SubmitAnswerResult は SubmitAnswer の結果。
type SubmitAnswerResult struct {
	IsCorrect       bool
	CorrectChoiceID string
	AttemptID       string
}

// GetQuestion は「次の問題」を返す。
// previousQuestionID が渡された場合、可能な限り直前の問題を避ける。
func (u *Usecase) GetQuestion(ctx context.Context, requestID string, previousQuestionID string) (domain.Question, error) {
	// previous_question_id は任意だが、入っているなら UUID として妥当かをチェックする。
	if previousQuestionID != "" {
		if _, err := uuid.Parse(previousQuestionID); err != nil {
			return domain.Question{}, apperror.InvalidArgument("previous_question_id が不正です", apperror.FieldViolation{Field: "previous_question_id", Description: "UUID 形式で指定してください"})
		}
	}

	// 保存済みの問題（= DBの questions）を優先し、無い場合は既定セットへフォールバックする。
	// ここでは「ユーザー作成が1件でもあるなら、system も含めた全体から抽選する」方針にする。
	nonSystemIDs, err := u.questionRepo.ListQuizCandidateNonSystemQuestionIDs(ctx, previousQuestionID)
	if err != nil {
		return domain.Question{}, err
	}

	var candidateIDs []string
	if len(nonSystemIDs) == 0 {
		candidateIDs, err = u.questionRepo.ListQuizCandidateSystemQuestionIDs(ctx, previousQuestionID)
	} else {
		candidateIDs, err = u.questionRepo.ListQuizCandidateQuestionIDs(ctx, previousQuestionID)
	}
	if err != nil {
		return domain.Question{}, err
	}

	// previous を除外した結果が空の場合、除外を解除して1問は返す（単一問題しかないケース）。
	if len(candidateIDs) == 0 && previousQuestionID != "" {
		if len(nonSystemIDs) == 0 {
			candidateIDs, err = u.questionRepo.ListQuizCandidateSystemQuestionIDs(ctx, "")
		} else {
			candidateIDs, err = u.questionRepo.ListQuizCandidateQuestionIDs(ctx, "")
		}
		if err != nil {
			return domain.Question{}, err
		}
	}

	if len(candidateIDs) == 0 {
		// DBが空のケースは既定セットへフォールバックする。
		return selectDefaultQuestion(requestID, previousQuestionID)
	}

	selectedID := pickDeterministically(requestID, candidateIDs)
	q, err := u.questionRepo.GetQuizQuestion(ctx, selectedID)
	if err != nil {
		// まれに整合性が崩れている場合はフォールバックで救済する。
		if apperror.IsCode(err, apperror.CodeNotFound) {
			return selectDefaultQuestion(requestID, previousQuestionID)
		}
		return domain.Question{}, err
	}
	return q, nil
}

// SubmitAnswer は回答を判定し、（認証済みなら）attempt を保存して結果を返す。
func (u *Usecase) SubmitAnswer(ctx context.Context, userID string, questionID string, selectedChoiceID string) (SubmitAnswerResult, error) {
	if questionID == "" {
		return SubmitAnswerResult{}, apperror.InvalidArgument("question_id が空です", apperror.FieldViolation{Field: "question_id", Description: "必須です"})
	}
	if selectedChoiceID == "" {
		return SubmitAnswerResult{}, apperror.InvalidArgument("selected_choice_id が空です", apperror.FieldViolation{Field: "selected_choice_id", Description: "必須です"})
	}
	if _, err := uuid.Parse(questionID); err != nil {
		return SubmitAnswerResult{}, apperror.InvalidArgument("question_id が不正です", apperror.FieldViolation{Field: "question_id", Description: "UUID 形式で指定してください"})
	}
	if _, err := uuid.Parse(selectedChoiceID); err != nil {
		return SubmitAnswerResult{}, apperror.InvalidArgument("selected_choice_id が不正です", apperror.FieldViolation{Field: "selected_choice_id", Description: "UUID 形式で指定してください"})
	}

	correctChoiceID, err := u.questionRepo.GetCorrectChoiceID(ctx, questionID)
	if err != nil {
		// DBに存在しない場合は既定問題セットも見る（DBが空のケース）。
		if apperror.IsCode(err, apperror.CodeNotFound) {
			if defaultCorrect, ok := defaultCorrectChoiceIDByQuestionID[questionID]; ok {
				return u.submitDefaultAnswer(userID, questionID, selectedChoiceID, defaultCorrect)
			}
		}
		return SubmitAnswerResult{}, err
	}

	belongs, err := u.questionRepo.ChoiceBelongsToQuestion(ctx, questionID, selectedChoiceID)
	if err != nil {
		return SubmitAnswerResult{}, err
	}
	if !belongs {
		return SubmitAnswerResult{}, apperror.InvalidArgument("selected_choice_id が question_id に紐づいていません")
	}

	isCorrect := selectedChoiceID == correctChoiceID
	attemptID := ""

	// 未ログインでもクイズは遊べるが、履歴（attempt）はログイン後のみ保存する。
	if userID != "" {
		if err := u.userRepo.EnsureUserExists(ctx, userID); err != nil {
			return SubmitAnswerResult{}, err
		}
		attemptID, err = u.attemptRepo.CreateAttempt(ctx, userID, questionID, selectedChoiceID, isCorrect)
		if err != nil {
			return SubmitAnswerResult{}, err
		}
	}

	return SubmitAnswerResult{
		IsCorrect:       isCorrect,
		CorrectChoiceID: correctChoiceID,
		AttemptID:       attemptID,
	}, nil
}

func (u *Usecase) submitDefaultAnswer(userID, questionID, selectedChoiceID, correctChoiceID string) (SubmitAnswerResult, error) {
	isCorrect := selectedChoiceID == correctChoiceID

	// DBが空の状態で履歴だけ保存しようとしても FK 制約で失敗するため、attempt は作らない。
	// 既定セットは「遊べる」ことを優先し、履歴は DB が整備されてからにする。
	if userID != "" {
		return SubmitAnswerResult{
			IsCorrect:       isCorrect,
			CorrectChoiceID: correctChoiceID,
			AttemptID:       "",
		}, nil
	}

	return SubmitAnswerResult{
		IsCorrect:       isCorrect,
		CorrectChoiceID: correctChoiceID,
		AttemptID:       "",
	}, nil
}

// selectDefaultQuestion は既定問題セットから1問を返す（previous を可能な限り避ける）。
func selectDefaultQuestion(requestID, previousQuestionID string) (domain.Question, error) {
	if len(defaultQuestions) == 0 {
		return domain.Question{}, apperror.NotFound("出題可能な問題がありません")
	}

	candidates := make([]domain.Question, 0, len(defaultQuestions))
	for _, q := range defaultQuestions {
		if q.ID == previousQuestionID {
			continue
		}
		candidates = append(candidates, q)
	}
	if len(candidates) == 0 {
		candidates = defaultQuestions
	}

	ids := make([]string, 0, len(candidates))
	for _, q := range candidates {
		ids = append(ids, q.ID)
	}
	selectedID := pickDeterministically(requestID, ids)
	for _, q := range candidates {
		if q.ID == selectedID {
			return q, nil
		}
	}
	return candidates[0], nil
}

// pickDeterministically は requestID と候補一覧から「毎回同じ選択」を行う。
// NOTE: テストの安定性（非決定性排除）を優先し、DBの random() は使わない。
func pickDeterministically(requestID string, candidateIDs []string) string {
	if len(candidateIDs) == 0 {
		return ""
	}

	seed := requestID
	if seed == "" {
		// requestID が無い場合でも毎回同じ結果になるよう、固定文字列にする。
		seed = "no-request-id"
	}

	sum := sha256.Sum256([]byte(seed))
	n := binary.BigEndian.Uint64(sum[:8])
	return candidateIDs[int(n%uint64(len(candidateIDs)))]
}
