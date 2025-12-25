package services

import (
	"context"

	quizv1 "github.com/history-quiz/historyquiz/proto/quiz/v1"
)

// QuizService は QuizServiceServer の暫定実装。
// NOTE: Phase1 の初期段階では DB 実装前のため、固定の問題を返す（後続タスクで置き換える）。
type QuizService struct {
	quizv1.UnimplementedQuizServiceServer
}

// NewQuizService は QuizService を生成する。
func NewQuizService() *QuizService {
	return &QuizService{}
}

func (s *QuizService) GetQuestion(ctx context.Context, req *quizv1.GetQuestionRequest) (*quizv1.GetQuestionResponse, error) {
	_ = ctx
	_ = req

	// 既定問題（暫定）。choices は常に4件に揃える。
	q := &quizv1.Question{
		Id:     "default-question-1",
		Prompt: "古代ローマの首都はどこ？",
		Choices: []*quizv1.Choice{
			{Id: "c1", Label: "ローマ", Ordinal: 0},
			{Id: "c2", Label: "アテネ", Ordinal: 1},
			{Id: "c3", Label: "カルタゴ", Ordinal: 2},
			{Id: "c4", Label: "アレクサンドリア", Ordinal: 3},
		},
		Explanation: "ローマは古代ローマの中心都市として知られる。",
	}

	return &quizv1.GetQuestionResponse{
		Context: req.GetContext(),
		Question: q,
	}, nil
}

func (s *QuizService) SubmitAnswer(ctx context.Context, req *quizv1.SubmitAnswerRequest) (*quizv1.SubmitAnswerResponse, error) {
	_ = ctx

	// 暫定: default-question-1 の正解は c1 とする。
	correctChoiceID := "c1"
	return &quizv1.SubmitAnswerResponse{
		Context:         req.GetContext(),
		IsCorrect:       req.GetSelectedChoiceId() == correctChoiceID,
		CorrectChoiceId: correctChoiceID,
		AttemptId:       "",
	}, nil
}

