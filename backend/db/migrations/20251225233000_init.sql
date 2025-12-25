-- history-quiz 初期スキーマ
-- NOTE: Phase1 では user_id は OIDC の sub を文字列で保持する前提（docs/Phase1/decisions.md）。

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- updated_at 自動更新用の共通関数
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- users: アプリ内ユーザー（現状は OIDC sub を主キーとして扱う）
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- questions: 4択問題
CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_user_id TEXT NOT NULL REFERENCES users(id),
  prompt TEXT NOT NULL,
  explanation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER questions_set_updated_at
BEFORE UPDATE ON questions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- choices: 選択肢（ordinal は 0..3 を想定）
CREATE TABLE IF NOT EXISTS choices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  ordinal INT NOT NULL CHECK (ordinal >= 0 AND ordinal <= 3),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 同一の問題内で ordinal が重複しないことを保証する
CREATE UNIQUE INDEX IF NOT EXISTS choices_question_ordinal_unique
ON choices(question_id, ordinal);

-- answer_keys: 正解（正解の選択肢が当該 question に属することを複合FKで保証）
CREATE TABLE IF NOT EXISTS answer_keys (
  question_id UUID PRIMARY KEY REFERENCES questions(id) ON DELETE CASCADE,
  correct_choice_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 複合FKのために (id, question_id) の一意性を用意する
CREATE UNIQUE INDEX IF NOT EXISTS choices_id_question_unique
ON choices(id, question_id);

ALTER TABLE answer_keys
  ADD CONSTRAINT answer_keys_correct_choice_belongs_to_question
  FOREIGN KEY (correct_choice_id, question_id)
  REFERENCES choices(id, question_id)
  ON DELETE CASCADE;

-- attempts: 解答履歴
CREATE TABLE IF NOT EXISTS attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id),
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  selected_choice_id UUID NOT NULL,
  is_correct BOOLEAN NOT NULL,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 選んだ選択肢が当該 question に属することを複合FKで保証
ALTER TABLE attempts
  ADD CONSTRAINT attempts_selected_choice_belongs_to_question
  FOREIGN KEY (selected_choice_id, question_id)
  REFERENCES choices(id, question_id)
  ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS attempts_user_answered_at_idx
ON attempts(user_id, answered_at DESC);

-- 4択（choices が必ず4件）をトランザクション終端で保証する制約トリガー。
-- NOTE: 作成/更新で choices を入れ替える場合、同一トランザクションで 4件に揃えばOKにする。
CREATE OR REPLACE FUNCTION enforce_four_choices_per_question()
RETURNS TRIGGER AS $$
DECLARE
  qid UUID;
  cnt INT;
BEGIN
  qid := COALESCE(NEW.question_id, OLD.question_id);
  SELECT COUNT(*) INTO cnt FROM choices WHERE question_id = qid;
  IF cnt <> 4 THEN
    RAISE EXCEPTION 'choices must be exactly 4 per question (question_id=%, count=%)', qid, cnt;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS choices_enforce_four_per_question ON choices;

CREATE CONSTRAINT TRIGGER choices_enforce_four_per_question
AFTER INSERT OR UPDATE OR DELETE ON choices
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION enforce_four_choices_per_question();

-- フォールバック用の既定問題セット（最小限）。
-- NOTE: 著作権リスクを避けるため、事実ベースの短い問題に留める。
INSERT INTO users (id)
VALUES ('system')
ON CONFLICT (id) DO NOTHING;

WITH seeded_questions AS (
  INSERT INTO questions (id, author_user_id, prompt, explanation)
  VALUES
    ('00000000-0000-0000-0000-000000000001', 'system', '古代ローマの首都はどこ？', 'ローマは古代ローマの中心都市として知られる。'),
    ('00000000-0000-0000-0000-000000000002', 'system', '中世ヨーロッパで十字軍が向かった主な目的地は？', '十字軍は主にエルサレムなど聖地の奪還を目的とした。'),
    ('00000000-0000-0000-0000-000000000003', 'system', '大航海時代にインド航路を開拓した人物は？', 'ヴァスコ・ダ・ガマは喜望峰を回ってインドへ到達した。')
  ON CONFLICT (id) DO NOTHING
  RETURNING id
)
SELECT 1;

-- choices / answer_keys（questionごとに4択を用意する）
-- Q1
INSERT INTO choices (id, question_id, label, ordinal) VALUES
  ('00000000-0000-0000-0000-000000001001', '00000000-0000-0000-0000-000000000001', 'ローマ', 0),
  ('00000000-0000-0000-0000-000000001002', '00000000-0000-0000-0000-000000000001', 'アテネ', 1),
  ('00000000-0000-0000-0000-000000001003', '00000000-0000-0000-0000-000000000001', 'カルタゴ', 2),
  ('00000000-0000-0000-0000-000000001004', '00000000-0000-0000-0000-000000000001', 'アレクサンドリア', 3)
ON CONFLICT (id) DO NOTHING;

INSERT INTO answer_keys (question_id, correct_choice_id) VALUES
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000001001')
ON CONFLICT (question_id) DO NOTHING;

-- Q2
INSERT INTO choices (id, question_id, label, ordinal) VALUES
  ('00000000-0000-0000-0000-000000002001', '00000000-0000-0000-0000-000000000002', 'エルサレム（聖地）', 0),
  ('00000000-0000-0000-0000-000000002002', '00000000-0000-0000-0000-000000000002', 'カイロ', 1),
  ('00000000-0000-0000-0000-000000002003', '00000000-0000-0000-0000-000000000002', 'コンスタンティノープル', 2),
  ('00000000-0000-0000-0000-000000002004', '00000000-0000-0000-0000-000000000002', 'ロンドン', 3)
ON CONFLICT (id) DO NOTHING;

INSERT INTO answer_keys (question_id, correct_choice_id) VALUES
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000002001')
ON CONFLICT (question_id) DO NOTHING;

-- Q3
INSERT INTO choices (id, question_id, label, ordinal) VALUES
  ('00000000-0000-0000-0000-000000003001', '00000000-0000-0000-0000-000000000003', 'コロンブス', 0),
  ('00000000-0000-0000-0000-000000003002', '00000000-0000-0000-0000-000000000003', 'マゼラン', 1),
  ('00000000-0000-0000-0000-000000003003', '00000000-0000-0000-0000-000000000003', 'ヴァスコ・ダ・ガマ', 2),
  ('00000000-0000-0000-0000-000000003004', '00000000-0000-0000-0000-000000000003', 'クック', 3)
ON CONFLICT (id) DO NOTHING;

INSERT INTO answer_keys (question_id, correct_choice_id) VALUES
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000003003')
ON CONFLICT (question_id) DO NOTHING;

