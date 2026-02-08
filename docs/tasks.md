# Tasks Document

本ドキュメントは `docs/requirements.md` / `docs/design.md` / `docs/tech.md` / `docs/structure.md` を前提に、実装を進めるためのタスクリストを定義する。
テンプレートは `.spec-workflow/templates/tasks-template.md` をベースとしている。

---

- [x] 1. プロジェクト骨格（ディレクトリ/初期設定）を作成する
  - File: `client/`, `backend/`, `proto/`（新規作成）
  - Purpose: `docs/structure.md` に沿った基本構造を確立し、以降の実装が迷子にならない状態にする
  - _Leverage: `docs/structure.md`, `docs/tech.md`_
  - _Requirements: 5.1, 5.2_
  - _Prompt: Role: Tech Lead | Task: Create initial monorepo directory skeleton (client/backend/proto) aligned with docs/structure.md; add minimal project entry docs if needed | Restrictions: Do not add unnecessary tooling; keep structure minimal but extensible | Success: Directory structure exists and matches structure.md; team can start implementing without ambiguity_

- [x] 1.1 ユーザー識別子（アプリ内 userId と OIDC sub）の扱いを確定する
  - File: `docs/Phase1/decisions.md`（追記）
  - Options:
    - A) `userId = OIDC sub` として扱い、マッピングを不要にする
    - B) アプリ内 userId（UUID）を発行し、`authSubject(sub)` と紐付ける
  - Purpose: 認可（所有者チェック）とDB設計、セッション保持方針のブレを防ぐ
  - _Leverage: `docs/design.md`（User）, `docs/tech.md`（Authentication）_
  - _Requirements: 9.4_
  - _Prompt: Role: Architect | Task: Decide user identifier strategy and document rationale and implications on DB schema, session, and gRPC metadata | Restrictions: Must support "user owns only their data" | Success: Decision recorded; downstream schema/API tasks can proceed consistently_

- [x] 1.2 DB マイグレーション運用（ツール/方針）を確定する
  - File: `docs/Phase1/decisions.md`（追記）
  - Purpose: `backend/db/migrations/` の適用手順・ローカル/CI方針を固定し、実装の手戻りを減らす
  - _Leverage: `docs/structure.md`（migrations）, `docs/tech.md`（Development Environment）_
  - _Requirements: 5.3_
  - _Prompt: Role: DevOps Engineer | Task: Decide migration tool and workflow (local, CI, prod) and document it in Phase1 decisions | Restrictions: Keep workflow simple; ensure repeatability | Success: Clear migration workflow documented and agreed_

- [x] 2. gRPC の契約（proto）を設計・追加する（共通メッセージ含む）
  - File: `proto/historyquiz/common/v1/common.proto`（新規）
  - Define: `UserContext`（userId, requestId 等）, `ErrorDetail` など、複数サービスで共有する型
  - Purpose: 境界契約（単一の真実）を先に固定し、Remix/Backend の手戻りを減らす
  - _Leverage: `docs/design.md`（Interfaces/Data Models）, `docs/tech.md`（Error Handling Standards）_
  - _Requirements: 5.2_
  - _Prompt: Role: API Designer (gRPC/Protobuf) | Task: Define shared protobuf messages for request context and standard error details; keep forward-compatible design | Restrictions: Avoid breaking-friendly fields; use optional fields and reserved tags appropriately | Success: common.proto compiles; messages are reusable across services_

- [x] 3. QuizService の proto を追加する（出題/回答）
  - File: `proto/historyquiz/quiz/v1/quiz_service.proto`（新規）
  - Define:
    - `GetQuestion`（次の問題取得）
    - `SubmitAnswer`（回答送信→正誤/説明/次導線用情報）
  - Purpose: クイズ体験（要件1,2,4）の中核RPCを確定する
  - _Leverage: `docs/requirements.md`（1,2,4）, `docs/design.md`（Interfaces/Data Models）_
  - _Requirements: 1.1-1.4, 2.1-2.2, 4.1-4.2_
  - _Prompt: Role: API Designer (gRPC) | Task: Design QuizService protobuf contract supporting get question and submit answer with necessary fields; include requestId propagation | Restrictions: Do not embed UI-specific strings excessively; keep contract stable | Success: quiz_service.proto compiles; supports requirements 1/2/4 end-to-end_

- [x] 4. QuestionService の proto を追加する（作問CRUD/自分の問題一覧）
  - File: `proto/historyquiz/question/v1/question_service.proto`（新規）
  - Define:
    - `CreateQuestion`, `UpdateQuestion`
    - `GetMyQuestion`（編集画面用）
    - `ListMyQuestions`
  - Purpose: 作問（要件3,7,8）の境界契約を確定する
  - _Leverage: `docs/requirements.md`（3,7,8）, `docs/design.md`（Data Models）, `docs/tech.md`（Security）_
  - _Requirements: 3.1-3.3, 7.1-7.2, 8.1-8.3, 9.4_
  - _Prompt: Role: API Designer (gRPC) | Task: Define QuestionService protobuf messages and RPCs for create/update/get/list with ownership constraints | Restrictions: Must not allow cross-user access; support validation errors via gRPC status + details | Success: question_service.proto compiles; supports create/list/edit flows_

- [x] 5. UserService の proto を追加する（履歴/統計）
  - File: `proto/historyquiz/user/v1/user_service.proto`（新規）
  - Define:
    - `ListMyAttempts`
    - `GetMyStats`（正答率など）
  - Purpose: マイページ（要件6）に必要なデータ契約を確定する
  - _Leverage: `docs/requirements.md`（6）, `docs/design.md`（Attempt/Data Models）_
  - _Requirements: 6.1-6.3, 9.4_
  - _Prompt: Role: API Designer (gRPC) | Task: Create protobuf contract for listing attempts and aggregated stats; include pagination considerations | Restrictions: Keep initial scope minimal; add pagination fields for future | Success: user_service.proto compiles; supports my page data needs_

- [x] 6. proto 生成方針を確定し、生成・利用の手順を整備する
  - File: `proto/README.md`（新規）
  - Purpose: Go/TypeScript 両方での生成方法とディレクトリ配置を固定し、契約駆動を回す
  - _Leverage: `docs/tech.md`（Proto generation）_
  - _Requirements: 5.2_
  - _Prompt: Role: Build Engineer | Task: Document proto generation strategy for Go server and TS client; propose tooling (buf/protoc) with minimal steps | Restrictions: Do not require network during normal dev if possible; keep commands reproducible | Success: proto/README.md provides clear commands and output locations_

- [x] 7. DB スキーマ（Question/Choice/AnswerKey/Attempt/User）を設計しマイグレーションを追加する
  - File: `backend/db/migrations/`（新規）
  - Include constraints:
    - 選択肢は常に4件（ordinal 0..3）
    - 正解は選択肢に含まれる（AnswerKey）
    - Attempt は userId で分離
  - Purpose: 要件・設計のデータモデルを永続化し、整合性をDBで担保する
  - _Leverage: `docs/design.md`（Data Models）, `docs/tech.md`（Security）_
  - _Requirements: 1.1, 3.2, 4.1, 6.1, 7.1, 8.2, 9.4_
  - _Prompt: Role: Database Engineer (Postgres) | Task: Create migrations for core tables with constraints and indexes; ensure ownership and data integrity | Restrictions: Keep schema minimal; avoid premature optimization | Success: Migrations apply cleanly; constraints enforce invariants (4 choices, correct choice belongs to question)_

- [x] 7.1 既定の問題セット（フォールバック用）を用意する
  - File: `backend/db/migrations/`（データ投入を追加）または `backend/internal/domain/quiz/default_questions.go`（新規）
  - Purpose: 保存済み問題が無い場合でもクイズが成立する状態を保証する（要件4）
  - _Leverage: `docs/requirements.md`（4.2）, `docs/design.md`（Error Scenarios: 出題可能な問題がない）_
  - _Requirements: 4.2_
  - _Prompt: Role: Backend Developer | Task: Implement default question set storage (DB seed or in-code) and ensure quiz selection falls back to it deterministically | Restrictions: Keep defaults minimal; avoid copyrighted content | Success: Fresh DB can serve quiz questions without user-created data_

- [x] 8. `sqlc` を導入し、クエリと生成コードの配置を確定する
  - File: `backend/sqlc.yaml`, `backend/db/queries/*.sql`（新規）
  - Purpose: 生SQLを単一の真実として保持しつつ、型安全なDBアクセスを実現する
  - _Leverage: `docs/tech.md`（sqlc）, `docs/structure.md`（db/queries）_
  - _Requirements: 5.2_
  - _Prompt: Role: Go Backend Engineer | Task: Set up sqlc configuration and starter queries for question/attempt CRUD | Restrictions: Follow structure.md; do not embed business logic in SQL beyond constraints | Success: sqlc generates Go types; repository layer can call generated code_

- [x] 9. Go バックエンドの基本骨格（cmd/internal レイヤ）を作成する
  - File: `backend/cmd/server/main.go`, `backend/internal/...`（新規）
  - Include:
    - gRPC サーバ起動
    - DI/初期化（DB接続、transport/usecase/repository）
  - Purpose: `docs/design.md` のレイヤ分離（transport→usecase→domain→repository）を実現する土台を作る
  - _Leverage: `docs/design.md`（Backend Layering）, `docs/structure.md`_
  - _Requirements: 5.2_
  - _Prompt: Role: Go Architect | Task: Scaffold clean architecture layout for gRPC server with transport/usecase/domain/repository/infrastructure; wire dependencies | Restrictions: Keep handlers thin; no domain logic in transport | Success: Server starts; internal package boundaries are clear_

- [x] 10. gRPC のメタデータ（userId/requestId）受け取りと認証・認可の入口を実装する
  - File: `backend/internal/transport/grpc/interceptors/*.go`（新規）
  - Purpose: 「ユーザー自身のデータのみ」制約を全RPCで一貫して適用できるようにする
  - _Leverage: `docs/tech.md`（Request ID, Security）, `docs/design.md`（Error Handling）_
  - _Requirements: 6.1, 7.1, 8.1, 9.4_
  - _Prompt: Role: Go Backend Engineer | Task: Implement interceptors to extract userId and requestId from metadata, enforce auth on protected methods, propagate requestId to logs | Restrictions: Do not trust client input; return proper gRPC status codes | Success: Protected RPCs reject unauthenticated calls; requestId is available in context_

- [x] 11. Quiz ユースケース（出題/フォールバック）を実装する
  - File: `backend/internal/usecase/quiz/*.go`（新規）
  - Implement:
    - 保存済み問題からの出題
    - 保存済みが無い場合の既定問題セットへのフォールバック
  - Purpose: 要件1/2/4の「次の問題」体験をバックエンドで保証する
  - _Leverage: `docs/requirements.md`（1,2,4）, `docs/design.md`（Error Scenarios）_
  - _Requirements: 1.1, 2.2, 4.1-4.2_
  - _Prompt: Role: Go Backend Developer | Task: Implement quiz question selection usecase with fallback logic; ensure deterministic behavior for tests | Restrictions: No UI concerns; keep logic testable; handle "no questions" clearly | Success: Usecase returns a question or NOT_FOUND with meaningful details_

- [x] 12. Quiz の判定・Attempt 保存を実装する
  - File: `backend/internal/usecase/quiz/*.go`（継続）, `backend/internal/usecase/attempt/*.go`（必要なら新規）
  - Purpose: 回答の正誤判定と履歴記録を一貫して行い、マイページ集計へ繋げる
  - _Leverage: `docs/design.md`（Attempt, AnswerKey）, `docs/tech.md`（Validation/Security）_
  - _Requirements: 1.2-1.4, 6.1_
  - _Prompt: Role: Go Backend Developer | Task: Implement submit answer usecase validating choice belongs to question, computing correctness, and persisting attempt | Restrictions: Must enforce ownership/userId separation; validate invariants server-side | Success: SubmitAnswer returns correctness and stores attempt reliably_

- [x] 13. Question の作成・更新・取得・一覧ユースケースを実装する（所有者チェック含む）
  - File: `backend/internal/usecase/question/*.go`（新規）
  - Purpose: 作問と管理（要件3,7,8）をバックエンド側の最終責務として保証する
  - _Leverage: `docs/requirements.md`（3,7,8,9）, `docs/tech.md`（Security）_
  - _Requirements: 3.1-3.3, 7.1-7.2, 8.1-8.3, 9.4_
  - _Prompt: Role: Go Backend Developer | Task: Implement question CRUD usecases with full validation (4 choices, correct choice) and ownership authorization | Restrictions: Must return PERMISSION_DENIED for cross-user access; validate all inputs | Success: User can create/list/get/update only their questions; invalid input is INVALID_ARGUMENT_

- [x] 14. マイページ用の履歴/統計ユースケースを実装する
  - File: `backend/internal/usecase/user/*.go`（新規）
  - Purpose: 要件6の「履歴表示」「正答率」を提供する
  - _Leverage: `docs/design.md`（Attempt）, `docs/requirements.md`（6）_
  - _Requirements: 6.1-6.3_
  - _Prompt: Role: Go Backend Developer | Task: Implement list attempts and compute stats (accuracy); keep aggregation efficient and testable | Restrictions: Do not leak other users' data; keep responses minimal | Success: Usecase returns attempts and stats for requesting user only_

- [x] 15. gRPC transport（QuizService/QuestionService/UserService）を実装する
  - File: `backend/internal/transport/grpc/*.go`（新規）
  - Purpose: proto 契約とユースケースを接続し、エラーを gRPC status に正しく落とす
  - _Leverage: `docs/tech.md`（Error Handling Standards）, `docs/design.md`（Backend Layering）_
  - _Requirements: 5.2_
  - _Prompt: Role: Go gRPC Engineer | Task: Implement gRPC handlers mapping requests to usecases; convert domain errors to gRPC status codes consistently | Restrictions: Keep handlers thin; no DB calls directly in transport | Success: All RPCs respond with correct status codes and payloads_

- [x] 16. バックエンドのユニットテスト（主要ユースケース）を追加する
  - File: `backend/internal/usecase/**/**/*_test.go`（新規）
  - Purpose: 出題フォールバック、判定、所有者認可、入力検証を回帰から守る
  - _Leverage: `docs/tech.md`（Testing Strategy）_
  - _Requirements: 1-4, 6-9_
  - _Prompt: Role: QA/Backend Engineer | Task: Write unit tests for usecases covering success/failure; include authorization and validation cases | Restrictions: Keep tests deterministic; avoid network/external dependencies | Success: Tests reliably cover main branches and edge cases_

- [x] 17. Remix アプリを初期化し、基本ルーティングを作成する
  - File: `client/app/routes/*`（新規）
  - Routes:
    - `/quiz`
    - `/questions/new`, `/questions/:id/edit`
    - `/me`
    - `/login`（OIDC 入口）
  - Purpose: 要件1-3/6-9 の画面導線を用意する
  - _Leverage: `docs/design.md`（HTTP interfaces）, `docs/structure.md`（client layering）_
  - _Requirements: 1.1, 3.1, 6.1, 7.1, 9.1_
  - _Prompt: Role: Remix Developer | Task: Scaffold Remix app routes for quiz/questions/me/login; keep routes thin and delegate to services | Restrictions: Use TypeScript; avoid importing gRPC client from browser bundles | Success: Routes render and server-side loaders/actions are in place_

- [x] 18. Remix のセッション基盤（Cookie）とログインガードを実装する
  - File: `client/app/services/session.server.ts`（新規）, `client/app/services/auth.server.ts`（新規）
  - Purpose: 未認証時に作問/マイページへアクセスできないようにし（要件9）、userId をサーバ側で安定的に保持する
  - _Leverage: `docs/tech.md`（Authentication）, `docs/design.md`（Security/Error Scenarios）_
  - _Requirements: 9.4_
  - _Prompt: Role: Security-minded Remix Developer | Task: Implement secure cookie session storage and helper to require authenticated user; provide redirect to login | Restrictions: Do not store raw tokens in client JS; set secure cookie flags appropriately | Success: Protected routes require login; userId accessible in server loaders/actions_

- [x] 19. Authentik（OIDC）連携を実装する（ログイン/コールバック）
  - File: `client/app/routes/login.tsx`, `client/app/routes/auth.callback.tsx`（新規想定）
  - Purpose: 要件9のログイン機能を実現し、OIDC の `sub` をアプリ内 userId に紐付ける
  - _Leverage: `docs/tech.md`（Authentik/OIDC）, `infra/authentik/*`_
  - _Requirements: 9.1-9.3_
  - _Prompt: Role: Auth Engineer (Remix/OIDC) | Task: Implement OIDC Authorization Code flow with Authentik, store user session, handle errors and logout | Restrictions: Avoid leaking secrets; validate state/nonce; keep server-only logic | Success: Users can log in and session persists; failures show clear error_

- [x] 20. Remix の gRPC クライアント（サーバ側専用）を実装する
  - File: `client/app/grpc/client.server.ts`（新規）, `client/app/grpc/*.ts`（新規）
  - Include:
    - requestId の生成/伝播
    - userId を metadata として付与
  - Purpose: Remix→Backend の呼び出しを集約し、ブラウザバンドルへ `@grpc/grpc-js` が混入しない構造にする
  - _Leverage: `docs/design.md`（gRPC 呼び出し方針）, `docs/tech.md`（Request ID）_
  - _Requirements: 5.2_
  - _Prompt: Role: Full-stack Engineer | Task: Build server-only gRPC client wrapper for Remix that attaches userId/requestId metadata and exposes typed methods | Restrictions: Ensure no client-side import; handle deadlines/timeouts | Success: Loader/action can call backend via wrapper; metadata is propagated_

- [x] 21. gRPC→HTTP エラー変換（共通）を実装する
  - File: `client/app/services/grpc-error.server.ts`（新規）
  - Purpose: `docs/tech.md` の変換表を単一の真実として適用し、全ルートで一貫したエラー表示にする
  - _Leverage: `docs/tech.md`（Error Handling Standards）_
  - _Requirements: 1.2, 3.3, 8.3, 9.3_
  - _Prompt: Role: Remix Backend-for-Frontend Engineer | Task: Implement helper to map gRPC status codes to HTTP responses and user-facing field errors; include requestId in response | Restrictions: Do not leak internal error details; keep mapping table consistent with docs | Success: All routes use common conversion; errors are consistent and debuggable_

- [x] 22. クイズ画面（取得→回答→判定→次へ）を実装する
  - File: `client/app/routes/quiz.tsx`（実装）
  - Include:
    - loader: `GetQuestion`
    - action: `SubmitAnswer`
    - 判定表示と「次へ」導線
  - Purpose: 要件1/2のユーザー体験を完成させる
  - _Leverage: `docs/requirements.md`（1,2）, `docs/design.md`（HTTP interfaces）_
  - _Requirements: 1.1-1.4, 2.1-2.2_
  - _Prompt: Role: Remix Developer (Forms/UX) | Task: Implement quiz route with loader/action calling gRPC; show immediate correctness and next question action | Restrictions: Use zod+conform for validation; handle loading/error states | Success: Users can answer and see correctness, then proceed to next question_

- [x] 23. 問題作成（フォーム/バリデーション/保存結果）を実装する
  - File: `client/app/routes/questions.new.tsx`（新規想定）, `client/app/schemas/question.ts`（新規）
  - Purpose: 要件3の作問フローを完成させる
  - _Leverage: `docs/tech.md`（zod+conform）, `docs/requirements.md`（3）_
  - _Requirements: 3.1-3.3, 9.4_
  - _Prompt: Role: Remix Developer | Task: Build question creation form with zod+conform, call CreateQuestion via gRPC, and display success/error | Restrictions: Validate all required fields; keep server-side authoritative | Success: Users can create questions; missing fields show per-field errors_

- [x] 24. マイページ（履歴/正答率/自作問題一覧/空状態）を実装する
  - File: `client/app/routes/me.tsx`（実装）
  - Purpose: 要件6/7の可視化を提供し、継続学習を支える
  - _Leverage: `docs/requirements.md`（6,7）, `docs/product.md`（Key Features）_
  - _Requirements: 6.1-6.3, 7.1-7.2, 9.4_
  - _Prompt: Role: Frontend Engineer | Task: Implement my page loader calling ListMyAttempts/GetMyStats/ListMyQuestions; render empty states clearly | Restrictions: Do not leak other users' data; handle unauthenticated redirect | Success: My page shows attempts, accuracy, and question list with empty state messaging_

- [ ] 25. 問題編集（取得→編集→保存）を実装する
  - File: `client/app/routes/questions.$id.edit.tsx`（新規想定）
  - Purpose: 要件8の編集フローを完成させる（所有者でない場合はエラー/禁止）
  - _Leverage: `docs/requirements.md`（8）, `docs/design.md`（Error Scenarios）_
  - _Requirements: 8.1-8.3, 9.4_
  - _Prompt: Role: Remix Developer | Task: Implement edit route with loader (GetMyQuestion) and action (UpdateQuestion); show field errors and success result | Restrictions: Must enforce auth; handle PERMISSION_DENIED gracefully | Success: Owners can edit; non-owners get 403-equivalent UX_

- [ ] 26. Remix の入力検証スキーマを整備し、フォームのエラー表現を統一する
  - File: `client/app/schemas/*`（新規/整理）
  - Purpose: `zod` + `conform` を前提に、バリデーションの重複と表示揺れを減らす
  - _Leverage: `docs/tech.md`（Validation）, `docs/structure.md`（schemas）_
  - _Requirements: 3.3, 8.3, 9.3_
  - _Prompt: Role: Frontend Architect | Task: Create consistent zod schemas for quiz answer and question forms and unify error mapping | Restrictions: Keep schemas server-side authoritative; avoid duplicating backend invariants too deeply | Success: All forms share common validation patterns and messages_

- [ ] 27. Remix↔Backend の統合テスト（主要フロー）を追加する
  - File: `client/app/tests/integration/*.test.ts`（新規）
  - Scenarios:
    - 出題→回答→次へ
    - 作問→一覧→編集
    - マイページ（履歴/統計）
  - Purpose: 境界（gRPC）を跨いだ主要ユースケースの壊れやすい部分を検知する
  - _Leverage: `docs/tech.md`（Integration Testing）_
  - _Requirements: All_
  - _Prompt: Role: Integration Test Engineer | Task: Implement integration tests for Remix services calling a test gRPC backend (or mocked transport) for key user flows | Restrictions: Keep tests deterministic; avoid external network | Success: Tests cover key flows and catch contract regressions_

- [ ] 28. E2E（最小限）を追加する（ログイン/作問/クイズ/マイページ）
  - File: `client/tests/e2e/*`（新規）
  - Purpose: 実ユーザ導線での退行を最小コストで防ぐ
  - _Leverage: `docs/tech.md`（End-to-End Testing）_
  - _Requirements: 1-9_
  - _Prompt: Role: QA Automation Engineer | Task: Add minimal E2E tests for main journeys; ensure they can run locally with dockerized deps | Restrictions: Keep suite small; avoid flaky waits; use stable selectors | Success: E2E covers critical flows and runs reliably_

- [ ] 29. ローカル開発手順を整備する（Authentik/DB/起動）
  - File: `docs/Phase1/local-development.md`（新規）
  - Include:
    - `infra/authentik` の起動手順
    - DB（Postgres/Neon のローカル代替）手順
    - client/backend の起動・環境変数
  - Purpose: オンボーディングと再現性を確保する（フェーズ別ドキュメント配置の方針に従う）
  - _Leverage: `infra/authentik/README.md`, `docs/tech.md`_
  - _Requirements: 5.3_
  - _Prompt: Role: Developer Experience Engineer | Task: Write Phase1 local dev guide including Authentik docker compose, env vars, and run commands | Restrictions: Keep instructions minimal and accurate; avoid external services where possible | Success: New dev can boot the system locally following the doc_

- [ ] 30. セキュリティ観点の最終確認（認証/認可/入力/エラー）を実施し、運用メモを更新する
  - File: `docs/Phase1/security-checklist.md`（新規）
  - Purpose: 「ユーザー自身のデータのみ」の保証と、境界（Remix/Backend）の責務を再確認する
  - _Leverage: `docs/tech.md`（Security, Threat Model）, `docs/design.md`（Error Handling）_
  - _Requirements: 9.4_
  - _Prompt: Role: Security Reviewer | Task: Create a practical checklist and ensure implementation aligns with it (session, OIDC, ownership checks, validation) | Restrictions: Checklist must be actionable; no vague items | Success: Checklist exists and can be used for pre-release review_
