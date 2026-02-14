# Design Document

## Overview

history-quiz は「クイズを解く（正誤判定・連続出題）」と「問題を作る（作成・編集・管理）」を中核とし、マイページで学習進捗（解答履歴・正答率）を可視化する。  
アーキテクチャとして Remix（SSR + BFF）を採用し、Remix ↔ Go バックエンドは gRPC で責務分離する。

本設計では以下を満たすことを主眼に置く。
- クイズ回答体験の高速性（平均 500ms 目標）
- 問題作成の操作性と入力バリデーション（平均 1s 目標）
- 認証・認可（ユーザー自身のデータのみ参照/編集）
- レイヤ分離（ブラウザ UI / Remix（BFF） / バックエンド）

## Steering Document Alignment

### Technical Standards (tech.md)
`docs/tech.md` に定義した方針に合わせ、本設計では以下の標準を採用する。
- API 仕様は「HTTP（Browser→Remix） + gRPC（Remix→Backend）」の2層を前提に、契約（スキーマ）を最優先で固定する
- 認証は Remix のセッション管理（Cookie）を採用し、ユーザー識別子を gRPC の metadata 等でバックエンドへ伝播する
- 入力バリデーションはサーバー側で必須
  - Remix は `zod` + `conform` による一次検証を行い、ユーザーに分かりやすい形でフィールドエラーを返す
  - Backend は最終防衛として、整合性/認可/ドメイン不変条件を必ず検証する（Remix を信頼しない）

### Project Structure (structure.md)
`docs/structure.md` に定義した方針に合わせ、本設計では以下の分割方針を採用する。
- `client/`（Remix アプリ。UI/SSR/BFF を含む）
- `backend/`（Go、gRPC サーバー、ドメインロジック、DB アクセス）
- `proto/`（gRPC 定義）

## Code Reuse Analysis
Phase1 で以下の共通コンポーネントを実装し、機能間で再利用している。
- gRPC クライアント共通層（`client/app/grpc/client.server.ts`）
- gRPC→HTTP エラー変換（`client/app/services/grpc-error.server.ts`）
- 認証/セッション共通層（`client/app/services/auth.server.ts`、`client/app/services/session.server.ts`）
- バックエンド共通エラー型（`backend/internal/domain/apperror/apperror.go`）

### Existing Components to Leverage
- **Remix 共通サービス群**: 認証、セッション、OIDC、エラー変換、gRPC 呼び出しラッパーを各 route から再利用する
- **Backend 共通層**: interceptor（metadata/userId/requestId）、usecase、repository interface をサービス横断で再利用する

### Integration Points
- **Database/Storage**: 4択問題、解答履歴、作成問題の永続化（PostgreSQL / Neon）
- **Authentication**: Authentik（OIDC）と連携し、Remix がセッション（Cookie）を保持する

## Architecture

ブラウザの UI 操作は HTTP で Remix（SSR サーバー）に集約し、Remix が gRPC で Go バックエンドへ委譲する。  
Remix は「認証・ルーティング/SSR・入出力整形・入力バリデーション・gRPC 呼び出し」に責務を限定し、クイズ判定や認可を含むビジネスルールはバックエンドに寄せる。

### Architecture Style
- **Go Backend**: クリーンアーキテクチャ（ヘキサゴナル/オニオンに近い考え方）
  - gRPC や DB（`pgx`/`sqlc`）は外側（インフラ）として扱い、ユースケースとドメインを中心に置く
  - 認可（所有者チェック等）とドメイン不変条件はバックエンドが最終責務として守る
- **Remix（BFF）**: レイヤード + ルート（機能）単位の分割
  - Remix の `loader/action` を入口として、入力検証（`zod` + `conform`）→ gRPC 呼び出し → 表示用データ整形の流れを明確にする
  - ドメインロジックは持たず、UX と境界処理に集中する

```mermaid
graph TD
  U[User] -->|Web UI| C[Browser]
  C -->|HTTP| R[Remix App<br/>(SSR + BFF)]
  R -->|gRPC| B[Go Backend]
  B -->|SQL| D[(Database)]
  R -->|OIDC| A[Authentik<br/>(OIDC Provider)]
  R -->|Cookie Session| S[(Session Store)]

%% 備考:
%% - Phase1 は Cookie（署名付き）でセッションを保持し、サーバー側の別ストアは使わない
```

### Modular Design Principles
- **Single File Responsibility**: 1ファイル1責務（HTTP ハンドラ、サービス、リポジトリを分離）
- **Service Layer Separation**: Remix は「HTTP/SSR + BFF層」、バックエンドは「ドメイン/ユースケース層」を中心に設計
- **Clear Interfaces**: HTTP/JSON と gRPC それぞれの契約を明確に定義し、互いの都合で破壊しない
- **Utility Modularity**: エラー変換、認証、ログなどは共通ユーティリティとして切り出す

### Backend Layering（Go）
バックエンドは以下の依存方向を守る（内側が外側に依存しない）。
- `transport(gRPC)` → `usecase` → `domain`
- `usecase` → `repository(interface)` → `infrastructure(sqlc/pgx)`

### Remix Layering（BFF）
Remix は以下の分割を基本とする。
- `routes (loader/action)` → `services (入力検証・エラー整形・呼び出し)` → `grpc client`

#### gRPC 呼び出し方針
- gRPC 呼び出しは Remix のサーバー側のみで行う（ブラウザから直接 gRPC は行わない）
- Remix の gRPC クライアント実装は `@grpc/grpc-js` を前提とし、ブラウザバンドルに混入しないように配置/import を分離する

## Components and Interfaces

### Remix App（Web / SSR + BFF）
- **Purpose:** クイズ出題・回答、問題作成/編集、マイページ表示、認証、入力バリデーション、gRPC 委譲
- **Interfaces（HTTP 例）:**
  - `GET /quiz`：クイズ画面（SSR/CSR）
  - `POST /quiz`：回答送信（Remix action）
  - `GET /questions/new`：問題作成画面
  - `POST /questions/new`：問題作成（Remix action）
  - `GET /questions/:id/edit`：問題編集画面
  - `POST /questions/:id/edit`：問題更新（Remix action）
  - `GET /me`：マイページ（履歴・正答率・作成問題一覧）
  - `GET /login`：OIDC 認証開始（未ログイン時は Authentik へリダイレクト）
  - `GET /auth/callback`：OIDC コールバック処理
- **Dependencies:** セッション管理（Cookie）、gRPC クライアント、エラー変換
- **Reuses:** 認証/セッション共通サービス、gRPC クライアント共通サービス、入力スキーマ

### Authentik（OIDC Provider）
- **Purpose:** 会員登録（メール+パスワード）、ログイン、メール確認、パスワードリセット等の認証機能を提供する
- **Interfaces:** OIDC（Authorization Code + PKCE を推奨）
- **Dependencies:** Authentik 自身の Postgres/Redis（セルフホスト時）
- **Reuses:** なし（初期）

補足:
- 運用（リソース管理/バックアップ/設定のコード化）は `docs/tech.md` の `Authentik Ops` を参照する。

### Go Backend（gRPC）
- **Purpose:** ドメインロジック（出題、判定、履歴/統計、作問 CRUD、認可）、DB 永続化
- **Interfaces（例）:**
  - `QuizService/GetQuestion`
  - `QuizService/SubmitAnswer`
  - `QuestionService/CreateQuestion`
  - `QuestionService/UpdateQuestion`
  - `QuestionService/ListMyQuestions`
  - `UserService/ListMyAttempts`
  - `UserService/GetMyStats`
- **Dependencies:** DB 接続、データアクセス層（Repository、`pgx`）
- **Reuses:** interceptor（認証・requestId 伝播）、共通エラー型、repository interface

## Data Models

本システムは「4択問題」と「解答（履歴）」を中心に据える。  
正答率は解答履歴から集計可能だが、性能要件や将来の分析拡張を考慮し、集計用ビュー/マテリアライズドビュー等は後から導入できるようにする。

### User
```
- id: string (OIDC sub)
- createdAt: datetime
```

### Question
```
- id: string (UUID)
- authorUserId: string         # 作成者（OIDC sub）
- prompt: string              # 問題文
- explanation: string?        # 任意（将来拡張）
- deletedAt: datetime?        # 論理削除（削除済みは出題/一覧から除外）
- createdAt: datetime
- updatedAt: datetime
```

### Choice
```
- id: string (UUID)
- questionId: string (UUID)
- label: string              # 選択肢の表示文
- ordinal: number            # 0..3（表示順）
```

### AnswerKey
```
- questionId: string (UUID)
- correctChoiceId: string (UUID)
```

### Attempt（解答履歴）
```
- id: string (UUID)
- userId: string
- questionId: string (UUID)
- selectedChoiceId: string (UUID)
- isCorrect: boolean
- answeredAt: datetime
```

### Deletion Policy（論理削除/物理削除）
- `Question` は `deletedAt` による論理削除を基本とする（解答履歴や正答率の整合性を維持するため）
- 削除済み `Question` は出題対象および通常の一覧/編集対象から除外する
- `Attempt`（解答履歴）はプロダクト要件（進捗表示）に直結するため、基本は保持する（削除方針は別途定める）

## Error Handling

### gRPC → HTTP 変換（標準）
Remix は gRPC status code を HTTP ステータスへ変換して返す。詳細な変換表とレスポンス形式は `docs/tech.md` の `Error Handling Standards` を単一の真実として参照する。

### Error Scenarios
1. **未認証でマイページ/作問へアクセス**
   - **Handling:** Remix で 401/リダイレクトを返し、ログイン導線へ誘導する
   - **User Impact:** 「ログインが必要です」を表示

2. **入力不備（問題文、選択肢、正解が不足）**
   - **Handling:** Remix で 400（details 付き）を返す。バックエンドでも再検証する
   - **User Impact:** 不足項目を特定できるエラー表示

3. **他人の問題を編集しようとする**
   - **Handling:** バックエンドで所有者チェックし 403 を返す
   - **User Impact:** 「権限がありません」を表示

4. **出題可能な問題がない**
   - **Handling:** バックエンドで「既定問題セット」へフォールバック。既定も空なら 404 と説明文を返す
   - **User Impact:** 出題できない理由を表示し、作問を促す

5. **バックエンド/DB 障害**
   - **Handling:** Remix は 500/503 を返し、リトライ可能である旨を付与。ログに相関IDを残す
   - **User Impact:** 「時間をおいて再試行してください」を表示

## Testing Strategy

### Unit Testing
- バックエンド：出題ロジック（決定的選択、既定セットフォールバック）、判定、所有者認可、入力検証
- Remix：認証/セッション、action/loader のバリデーション、エラー変換（gRPC → HTTP）

### Integration Testing
- Remix ↔ gRPC：主要フロー（出題→回答、作問→一覧→編集、マイページの履歴/統計）
- DB：CRUD と制約（選択肢4件、正解が必ず選択肢内、ユーザー分離）

### End-to-End Testing
- 「クイズを開始→回答→次へ」の一連操作
- 「ログイン→作問→クイズで出題される→マイページで履歴/正答率を確認」

## Development Approach

本プロジェクトは「ユースケース駆動（縦切り）」で開発を進める。

### ユースケース駆動（縦切り）
- 1つのユースケースを、UI（Remix）→ gRPC → Backend → DB まで貫いて完成させる
- 例: 「クイズを1問取得→回答→正誤表示」「作問→保存→一覧→編集」

### 契約駆動（proto 先行）
- Remix ↔ Backend の境界は `proto` を単一の真実として先に確定する
- `proto` 更新 → 生成/スタブ → Backend 実装 → Remix 接続の順で手戻りを減らす

### テストピラミッド
- Backend: ユースケース/ドメインの Unit を厚く、gRPC は統合テストで主要経路を確認
- Remix: 入力検証（`zod` + `conform`）と境界処理（エラー整形等）を中心にテスト
- E2E: 主要ユースケースのみ（ログイン、作問、クイズ、マイページ）
