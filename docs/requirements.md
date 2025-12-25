# Requirements Document

## Introduction

history-quiz は世界史の4択クイズを出題し、回答の正誤判定を行うクイズモードと、4択問題を作成できる問題作成モードを提供する。学習用途の軽量なクイズ体験を提供し、ユーザーが自作問題で学習内容を拡張できる価値を持つ。

## Alignment with Product Vision

プロダクトビジョン文書は未整備のため、依頼内容に基づき「世界史を楽しく学習できるクイズ体験の提供」と「ユーザーによる問題作成で学習の幅を広げる」方針に整合させる。必要に応じてビジョン文書の整備を相談する。

## Requirements

### Requirement 1

**User Story:** 学習者として、世界史の4択クイズを解きたいので、知識の定着度を確認できるようにしたい。

#### Acceptance Criteria

1. WHEN クイズモードを開始したとき THEN システム SHALL 世界史の4択問題を1問表示する。
2. WHEN ユーザーが回答を選択したとき THEN システム SHALL 正誤判定を即時に表示する。
3. IF 正解である場合 THEN システム SHALL 正解である旨の結果を表示する。
4. IF 不正解である場合 THEN システム SHALL 不正解である旨の結果を表示する。

### Requirement 2

**User Story:** 学習者として、複数の問題を連続で解きたいので、学習を継続できるようにしたい。

#### Acceptance Criteria

1. WHEN 正誤判定が表示されたとき THEN システム SHALL 次の問題へ進む操作を提供する。
2. WHEN 次の問題へ進む操作を実行したとき THEN システム SHALL 別の4択問題を表示する。

### Requirement 3

**User Story:** 出題者として、4択の世界史問題を作成したいので、自分の学習内容を追加できるようにしたい。

#### Acceptance Criteria

1. WHEN 問題作成モードを開いたとき THEN システム SHALL 問題文、4つの選択肢、正解選択肢を入力できるフォームを表示する。
2. WHEN 作成内容を送信したとき THEN システム SHALL 入力内容の保存結果を表示する。
3. IF 入力が不完全である場合 THEN システム SHALL 必須項目の不足を示すエラーメッセージを表示する。

### Requirement 4

**User Story:** 学習者として、作成された問題をクイズに使いたいので、作成済み問題が出題されるようにしたい。

#### Acceptance Criteria

1. WHEN クイズモードで出題するとき THEN システム SHALL 保存済みの問題を出題対象に含める。
2. IF 保存済み問題が存在しない場合 THEN システム SHALL 既定の問題セットから出題する。

### Requirement 5

**User Story:** システム運用者として、クライアント・APIGateway・バックエンドの責務を分離したいので、選定した通信方式で連携できるようにしたい。

#### Acceptance Criteria

1. WHEN クライアントがデータ取得や送信を行うとき THEN システム SHALL HTTP/JSON を介して APIGateway と通信する。
2. WHEN APIGateway がバックエンドに処理を委譲するとき THEN システム SHALL gRPC を介して Go バックエンドと通信する。
3. IF 選定方式で実装上の不都合が判明した場合 THEN システム SHALL 代替案を検討するための相談事項を提示する。

### Requirement 6

**User Story:** 学習者として、マイページで学習の進捗を確認したいので、解答履歴や正答率を把握できるようにしたい。

#### Acceptance Criteria

1. WHEN マイページを開いたとき THEN システム SHALL 解答履歴を表示する。
2. WHEN マイページを開いたとき THEN システム SHALL 正答率を表示する。
3. IF 解答履歴が存在しない場合 THEN システム SHALL 空状態の説明を表示する。

### Requirement 7

**User Story:** 出題者として、マイページから作成した問題を管理したいので、作成済み問題一覧を確認できるようにしたい。

#### Acceptance Criteria

1. WHEN マイページを開いたとき THEN システム SHALL 作成した問題の一覧を表示する。
2. IF 作成済み問題が存在しない場合 THEN システム SHALL 空状態の説明を表示する。

### Requirement 8

**User Story:** 出題者として、作成した問題を修正したいので、問題を編集できるようにしたい。

#### Acceptance Criteria

1. WHEN 作成済み問題の編集操作を選択したとき THEN システム SHALL 問題文と選択肢を編集できるフォームを表示する。
2. WHEN 編集内容を保存したとき THEN システム SHALL 更新結果を表示する。
3. IF 入力が不完全である場合 THEN システム SHALL 必須項目の不足を示すエラーメッセージを表示する。

### Requirement 9

**User Story:** 利用者として、マイページや問題作成を自分のデータで利用したいので、ログインできるようにしたい。

#### Acceptance Criteria

1. WHEN ログイン画面を開いたとき THEN システム SHALL 認証情報を入力できるフォームを表示する。
2. WHEN 認証情報を送信したとき THEN システム SHALL 認証結果を表示する。
3. IF 認証に失敗した場合 THEN システム SHALL エラーメッセージを表示する。
4. WHEN 認証済みでない利用者がマイページや問題作成を開こうとしたとき THEN システム SHALL ログインを促す。

## Non-Functional Requirements

### Code Architecture and Modularity
- **Single Responsibility Principle**: 各モジュールは単一の責務を持つ。
- **Modular Design**: フロント、APIGateway、バックエンドは明確に分離し、再利用可能な単位で実装する。
- **Dependency Management**: 不要な依存を避け、各レイヤーの責務を侵食しない。
- **Clear Interfaces**: HTTP/JSON と gRPC のインターフェースを明確に定義する。

### Performance
- クイズ取得と判定結果の表示は平均 500ms 以内を目標とする（ローカル環境）。
- 作成済み問題の登録は平均 1s 以内を目標とする。

### Security
- 入力値はサーバー側でバリデーションする。
- 認証・セッション管理に必要なトークンの取り扱い方針を設計時に明確化する。
- 認可の観点から、ユーザー自身のデータのみ参照・編集できるようにする。

### Reliability
- クイズ出題と問題作成はエラー時に明確なメッセージを返し、再試行可能にする。

### Usability
- モード切替は一目で分かる導線を提供する。
- スマートフォンでも操作可能なレスポンシブUIを提供する。
