package domain

import "time"

// Choice は 4択問題の選択肢。
type Choice struct {
	ID      string
	Label   string
	Ordinal int32
}

// Question はクイズ出題で使う問題（正解は含めない）。
type Question struct {
	ID          string
	Prompt      string
	Choices     []Choice
	Explanation string
}

// QuestionDraft は作問入力（作成/更新で共通）。
type QuestionDraft struct {
	Prompt         string
	Choices        []string
	CorrectOrdinal int32
	Explanation    string
}

// QuestionSummary は一覧表示向けの最小情報。
type QuestionSummary struct {
	ID        string
	Prompt    string
	UpdatedAt time.Time
}

// QuestionDetail は編集画面向けの詳細。
type QuestionDetail struct {
	ID              string
	Prompt           string
	Choices          []Choice
	CorrectChoiceID  string
	Explanation      string
	UpdatedAt        time.Time
}

// Attempt は解答履歴。
type Attempt struct {
	ID              string
	QuestionID       string
	QuestionPrompt   string
	SelectedChoiceID string
	IsCorrect        bool
	AnsweredAt       time.Time
}

// Stats はマイページ向けの統計。
type Stats struct {
	TotalAttempts   int64
	CorrectAttempts int64
	Accuracy        float64
}

