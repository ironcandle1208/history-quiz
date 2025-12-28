package postgres

import (
	"context"
	"fmt"
	"time"

	"github.com/history-quiz/historyquiz/internal/domain"
	"github.com/history-quiz/historyquiz/internal/domain/apperror"
	"github.com/history-quiz/historyquiz/internal/repository"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// QuestionRepository は Postgres 実装の questions/choices/answer_keys リポジトリ。
type QuestionRepository struct {
	pool *pgxpool.Pool
}

var _ repository.QuestionRepository = (*QuestionRepository)(nil)

// NewQuestionRepository は QuestionRepository を生成する。
func NewQuestionRepository(pool *pgxpool.Pool) *QuestionRepository {
	return &QuestionRepository{pool: pool}
}

func (r *QuestionRepository) ListQuizCandidateQuestionIDs(ctx context.Context, previousQuestionID string) ([]string, error) {
	return r.listQuizCandidates(ctx, previousQuestionID, "")
}

func (r *QuestionRepository) ListQuizCandidateSystemQuestionIDs(ctx context.Context, previousQuestionID string) ([]string, error) {
	return r.listQuizCandidates(ctx, previousQuestionID, "system")
}

func (r *QuestionRepository) ListQuizCandidateNonSystemQuestionIDs(ctx context.Context, previousQuestionID string) ([]string, error) {
	return r.listQuizCandidates(ctx, previousQuestionID, "non-system")
}

func (r *QuestionRepository) listQuizCandidates(ctx context.Context, previousQuestionID string, mode string) ([]string, error) {
	var sql string
	switch mode {
	case "":
		sql = `SELECT id::text
			   FROM questions
			   WHERE deleted_at IS NULL
			     AND ($1 = '' OR id::text <> $1)
			   ORDER BY created_at DESC`
	case "system":
		sql = `SELECT id::text
			   FROM questions
			   WHERE deleted_at IS NULL
			     AND author_user_id = 'system'
			     AND ($1 = '' OR id::text <> $1)
			   ORDER BY created_at DESC`
	case "non-system":
		sql = `SELECT id::text
			   FROM questions
			   WHERE deleted_at IS NULL
			     AND author_user_id <> 'system'
			     AND ($1 = '' OR id::text <> $1)
			   ORDER BY created_at DESC`
	default:
		return nil, apperror.Internal("出題候補の取得に失敗しました", fmt.Errorf("unknown mode: %s", mode))
	}

	rows, err := r.pool.Query(ctx, sql, previousQuestionID)
	if err != nil {
		return nil, apperror.Internal("出題候補の取得に失敗しました", fmt.Errorf("select candidates: %w", err))
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, apperror.Internal("出題候補の読み取りに失敗しました", fmt.Errorf("scan candidates: %w", err))
		}
		ids = append(ids, id)
	}
	if err := rows.Err(); err != nil {
		return nil, apperror.Internal("出題候補の取得に失敗しました", fmt.Errorf("candidate rows: %w", err))
	}
	return ids, nil
}

func (r *QuestionRepository) GetQuizQuestion(ctx context.Context, questionID string) (domain.Question, error) {
	var q domain.Question
	err := r.pool.QueryRow(
		ctx,
		`SELECT id::text, prompt, COALESCE(explanation, '')
		 FROM questions
		 WHERE id = $1::uuid
		   AND deleted_at IS NULL`,
		questionID,
	).Scan(&q.ID, &q.Prompt, &q.Explanation)
	if err == pgx.ErrNoRows {
		return domain.Question{}, apperror.NotFound("問題が見つかりません")
	}
	if err != nil {
		// uuid パース失敗などが含まれるため INVALID_ARGUMENT として扱う。
		return domain.Question{}, apperror.InvalidArgument("question_id が不正です")
	}

	choices, err := r.listChoices(ctx, questionID)
	if err != nil {
		return domain.Question{}, err
	}
	q.Choices = choices
	return q, nil
}

func (r *QuestionRepository) GetCorrectChoiceID(ctx context.Context, questionID string) (string, error) {
	var correctChoiceID string
	err := r.pool.QueryRow(
		ctx,
		`SELECT correct_choice_id::text
		 FROM answer_keys
		 WHERE question_id = $1::uuid`,
		questionID,
	).Scan(&correctChoiceID)
	if err == pgx.ErrNoRows {
		return "", apperror.NotFound("正解情報が見つかりません")
	}
	if err != nil {
		return "", apperror.InvalidArgument("question_id が不正です")
	}
	return correctChoiceID, nil
}

func (r *QuestionRepository) ChoiceBelongsToQuestion(ctx context.Context, questionID string, choiceID string) (bool, error) {
	var ok bool
	err := r.pool.QueryRow(
		ctx,
		`SELECT EXISTS(
		   SELECT 1
		   FROM choices
		   WHERE question_id = $1::uuid
		     AND id = $2::uuid
		 )`,
		questionID,
		choiceID,
	).Scan(&ok)
	if err != nil {
		return false, apperror.InvalidArgument("question_id または selected_choice_id が不正です")
	}
	return ok, nil
}

func (r *QuestionRepository) CreateQuestion(ctx context.Context, authorUserID string, draft domain.QuestionDraft) (domain.QuestionDetail, error) {
	if authorUserID == "" {
		return domain.QuestionDetail{}, apperror.Unauthenticated("認証が必要です")
	}

	var detail domain.QuestionDetail
	err := withTx(ctx, r.pool, func(tx pgx.Tx) error {
		var questionID string
		var updatedAt time.Time
		err := tx.QueryRow(
			ctx,
			`INSERT INTO questions (author_user_id, prompt, explanation)
			 VALUES ($1, $2, $3)
			 RETURNING id::text, updated_at`,
			authorUserID,
			draft.Prompt,
			nullIfEmpty(draft.Explanation),
		).Scan(&questionID, &updatedAt)
		if err != nil {
			return apperror.InvalidArgument("問題の作成に失敗しました（入力が不正です）")
		}

		choices, correctChoiceID, err := insertChoicesAndAnswerKey(ctx, tx, questionID, draft)
		if err != nil {
			return err
		}

		detail = domain.QuestionDetail{
			ID:             questionID,
			Prompt:          draft.Prompt,
			Choices:         choices,
			CorrectChoiceID: correctChoiceID,
			Explanation:     draft.Explanation,
			UpdatedAt:       updatedAt,
		}
		return nil
	})
	if err != nil {
		return domain.QuestionDetail{}, err
	}
	return detail, nil
}

func (r *QuestionRepository) UpdateQuestion(ctx context.Context, userID string, questionID string, draft domain.QuestionDraft) (domain.QuestionDetail, error) {
	var detail domain.QuestionDetail
	err := withTx(ctx, r.pool, func(tx pgx.Tx) error {
		var updatedAt time.Time
		err := tx.QueryRow(
			ctx,
			`UPDATE questions
			 SET prompt = $1,
			     explanation = $2
			 WHERE id = $3::uuid
			   AND author_user_id = $4
			   AND deleted_at IS NULL
			 RETURNING updated_at`,
			draft.Prompt,
			nullIfEmpty(draft.Explanation),
			questionID,
			userID,
		).Scan(&updatedAt)
		if err == pgx.ErrNoRows {
			return apperror.NotFound("問題が見つかりません")
		}
		if err != nil {
			return apperror.InvalidArgument("question_id が不正です")
		}

		if _, err := tx.Exec(ctx, `DELETE FROM choices WHERE question_id = $1::uuid`, questionID); err != nil {
			return apperror.Internal("選択肢の更新に失敗しました", fmt.Errorf("delete choices: %w", err))
		}

		choices, correctChoiceID, err := insertChoicesAndAnswerKey(ctx, tx, questionID, draft)
		if err != nil {
			return err
		}

		detail = domain.QuestionDetail{
			ID:             questionID,
			Prompt:          draft.Prompt,
			Choices:         choices,
			CorrectChoiceID: correctChoiceID,
			Explanation:     draft.Explanation,
			UpdatedAt:       updatedAt,
		}
		return nil
	})
	if err != nil {
		return domain.QuestionDetail{}, err
	}
	return detail, nil
}

func (r *QuestionRepository) GetMyQuestion(ctx context.Context, userID string, questionID string) (domain.QuestionDetail, error) {
	var prompt string
	var explanation string
	var updatedAt time.Time

	err := r.pool.QueryRow(
		ctx,
		`SELECT prompt, COALESCE(explanation, ''), updated_at
		 FROM questions
		 WHERE id = $1::uuid
		   AND author_user_id = $2
		   AND deleted_at IS NULL`,
		questionID,
		userID,
	).Scan(&prompt, &explanation, &updatedAt)
	if err == pgx.ErrNoRows {
		return domain.QuestionDetail{}, apperror.NotFound("問題が見つかりません")
	}
	if err != nil {
		return domain.QuestionDetail{}, apperror.InvalidArgument("question_id が不正です")
	}

	choices, err := r.listChoices(ctx, questionID)
	if err != nil {
		return domain.QuestionDetail{}, err
	}

	correctChoiceID, err := r.GetCorrectChoiceID(ctx, questionID)
	if err != nil {
		return domain.QuestionDetail{}, err
	}

	return domain.QuestionDetail{
		ID:             questionID,
		Prompt:          prompt,
		Choices:         choices,
		CorrectChoiceID: correctChoiceID,
		Explanation:     explanation,
		UpdatedAt:       updatedAt,
	}, nil
}

func (r *QuestionRepository) ListMyQuestions(ctx context.Context, userID string, limit int32) ([]domain.QuestionSummary, error) {
	rows, err := r.pool.Query(
		ctx,
		`SELECT id::text, prompt, updated_at
		 FROM questions
		 WHERE author_user_id = $1
		   AND deleted_at IS NULL
		 ORDER BY updated_at DESC
		 LIMIT $2`,
		userID,
		limit,
	)
	if err != nil {
		return nil, apperror.Internal("作成済み問題の一覧取得に失敗しました", fmt.Errorf("select my questions: %w", err))
	}
	defer rows.Close()

	questions := make([]domain.QuestionSummary, 0, limit)
	for rows.Next() {
		var q domain.QuestionSummary
		var updatedAt time.Time
		if err := rows.Scan(&q.ID, &q.Prompt, &updatedAt); err != nil {
			return nil, apperror.Internal("作成済み問題の読み取りに失敗しました", fmt.Errorf("scan my questions: %w", err))
		}
		q.UpdatedAt = updatedAt
		questions = append(questions, q)
	}
	if err := rows.Err(); err != nil {
		return nil, apperror.Internal("作成済み問題の一覧取得に失敗しました", fmt.Errorf("my questions rows: %w", err))
	}

	return questions, nil
}

func (r *QuestionRepository) GetQuestionAuthor(ctx context.Context, questionID string) (string, bool, error) {
	var authorUserID string
	var deletedAt *time.Time
	err := r.pool.QueryRow(
		ctx,
		`SELECT author_user_id, deleted_at
		 FROM questions
		 WHERE id = $1::uuid`,
		questionID,
	).Scan(&authorUserID, &deletedAt)
	if err == pgx.ErrNoRows {
		return "", false, apperror.NotFound("問題が見つかりません")
	}
	if err != nil {
		return "", false, apperror.InvalidArgument("question_id が不正です")
	}
	return authorUserID, deletedAt != nil, nil
}

func (r *QuestionRepository) listChoices(ctx context.Context, questionID string) ([]domain.Choice, error) {
	rows, err := r.pool.Query(
		ctx,
		`SELECT id::text, label, ordinal
		 FROM choices
		 WHERE question_id = $1::uuid
		 ORDER BY ordinal ASC`,
		questionID,
	)
	if err != nil {
		return nil, apperror.Internal("選択肢の取得に失敗しました", fmt.Errorf("select choices: %w", err))
	}
	defer rows.Close()

	var choices []domain.Choice
	for rows.Next() {
		var c domain.Choice
		if err := rows.Scan(&c.ID, &c.Label, &c.Ordinal); err != nil {
			return nil, apperror.Internal("選択肢の読み取りに失敗しました", fmt.Errorf("scan choices: %w", err))
		}
		choices = append(choices, c)
	}
	if err := rows.Err(); err != nil {
		return nil, apperror.Internal("選択肢の取得に失敗しました", fmt.Errorf("choice rows: %w", err))
	}
	return choices, nil
}

// insertChoicesAndAnswerKey は choices を 4件挿入し、answer_keys を設定する。
// NOTE: 正解の choice_id は挿入後に確定するため、ordinal をキーにして対応付ける。
func insertChoicesAndAnswerKey(ctx context.Context, tx pgx.Tx, questionID string, draft domain.QuestionDraft) ([]domain.Choice, string, error) {
	choices := make([]domain.Choice, 0, len(draft.Choices))
	correctChoiceID := ""

	for i, label := range draft.Choices {
		ordinal := int32(i)

		var choiceID string
		if err := tx.QueryRow(
			ctx,
			`INSERT INTO choices (question_id, label, ordinal)
			 VALUES ($1::uuid, $2, $3)
			 RETURNING id::text`,
			questionID,
			label,
			ordinal,
		).Scan(&choiceID); err != nil {
			return nil, "", apperror.InvalidArgument("選択肢の作成に失敗しました（入力が不正です）")
		}

		choices = append(choices, domain.Choice{
			ID:      choiceID,
			Label:   label,
			Ordinal: ordinal,
		})
		if ordinal == draft.CorrectOrdinal {
			correctChoiceID = choiceID
		}
	}

	if correctChoiceID == "" {
		return nil, "", apperror.InvalidArgument("correct_ordinal が不正です", apperror.FieldViolation{Field: "draft.correct_ordinal", Description: "0..3 の範囲で指定してください"})
	}

	if _, err := tx.Exec(
		ctx,
		`INSERT INTO answer_keys (question_id, correct_choice_id)
		 VALUES ($1::uuid, $2::uuid)
		 ON CONFLICT (question_id) DO UPDATE SET correct_choice_id = EXCLUDED.correct_choice_id`,
		questionID,
		correctChoiceID,
	); err != nil {
		return nil, "", apperror.InvalidArgument("正解情報の保存に失敗しました（入力が不正です）")
	}

	return choices, correctChoiceID, nil
}

// nullIfEmpty は空文字を NULL に変換する（DB の列を nullable として扱うため）。
func nullIfEmpty(s string) any {
	if s == "" {
		return nil
	}
	return s
}
