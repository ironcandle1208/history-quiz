# Walkthrough: task16 バックエンド主要ユースケースのユニットテスト追加

## 目的

`docs/tasks.md` の 16「バックエンドのユニットテスト（主要ユースケース）を追加する」を実装し、以下の回帰を防ぐ。

- 出題のフォールバック（DB が空/整合性が崩れたケース）
- 回答判定と入力検証
- 作問の入力検証
- 所有者認可（他ユーザーの問題を更新できない）
- マイページ系ユースケースの未認証ブロックと pageSize 正規化

## 変更内容（追加ファイル）

- `backend/internal/usecase/quiz/service_test.go`
  - `GetQuestion` の `previous_question_id` 検証、候補除外→解除、既定問題へのフォールバックをテスト
  - `SubmitAnswer` の attempt 保存（ログイン時）と、既定問題セット時に attempt を作らない挙動をテスト
  - `selected_choice_id` の整合性（問題に紐づかない選択肢）をテスト

- `backend/internal/usecase/question/service_test.go`
  - `CreateQuestion` の未認証/入力不正/成功をテスト
  - `UpdateQuestion` の deleted→NOT_FOUND、他ユーザー→PERMISSION_DENIED、成功をテスト
  - `ListMyQuestions` の pageSize 正規化（<=0 は 20、>100 は 100）をテスト

- `backend/internal/usecase/user/service_test.go`
  - `ListMyAttempts` の未認証ブロック、pageSize 正規化をテスト
  - `GetMyStats` の未認証ブロック、成功をテスト

## テストの実行方法

### 推奨（スクリプト）

リポジトリ直下から、以下を実行する。

```sh
bash backend/scripts/test.sh
bash backend/scripts/test.sh --cover
bash backend/scripts/test.sh --coverprofile
```

### 推奨（Makefile）

`backend/` 配下で、以下を実行する。

```sh
cd backend
make test
make test-cover
make test-coverprofile
```

### 直接実行（メモ）

`backend/` に移動して、以下を実行する。

```sh
cd backend
mkdir -p .gocache .gotmp
GOCACHE=$PWD/.gocache GOTMPDIR=$PWD/.gotmp go test ./...
```

### 補足（なぜ GOCACHE/GOTMPDIR を指定するのか）

環境（サンドボックス/権限設定）によっては、Go のデフォルトキャッシュディレクトリ（例: `~/Library/Caches/go-build`）への書き込みが許可されず `operation not permitted` になることがある。

そのため、ワークスペース配下にキャッシュ/一時ディレクトリを寄せてテストを安定させる。
