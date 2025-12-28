-- questions 論理削除（deleted_at）を追加
-- NOTE: 過去の解答履歴（attempts）との整合性を保つため、questions は物理削除ではなく論理削除を基本とする。

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 一覧/管理（作者別）で削除済みを除外した検索が多いため、部分インデックスを用意する
CREATE INDEX IF NOT EXISTS questions_author_created_at_active_idx
  ON questions(author_user_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- 削除日時での絞り込み/メンテナンスに備えて（必要になったら利用）
CREATE INDEX IF NOT EXISTS questions_deleted_at_idx
  ON questions(deleted_at);

