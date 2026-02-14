# Project Structure

## Directory Organization

本プロジェクトは「機能（学習/作問/マイページ）」を提供しつつ、アーキテクチャ上は Browser / Remix（SSR + BFF） / Backend を分離する。  
以下は Phase1 実装時点の実ディレクトリ構成をベースにした標準構造であり、以後の変更時は本書を更新する。

```
project-root/
├── client/                       # Remix アプリ（TypeScript, React, SSR + BFF）
│   ├── app/                      # ルート/画面/loader/action
│   ├── public/
│   └── tests/
├── backend/                      # Go バックエンド（gRPC）
│   ├── cmd/                      # エントリポイント（サーバー起動など）
│   ├── internal/                 # 内部実装（ドメイン/ユースケース/DB 等）
│   ├── db/                       # DB関連（マイグレーション、sqlc 入力SQLなど）
│   │   ├── migrations/           # スキーマ変更（ツールは実装で選定）
│   │   └── queries/              # sqlc の入力SQL（生SQLを単一の真実にする）
│   ├── scripts/                  # テスト補助スクリプト等
│   └── sqlc.yaml                 # sqlc 設定ファイル
├── infra/                        # ローカル開発/運用の補助（例: Authentik）
│   └── authentik/
│       ├── docker-compose.yml
│       ├── .env.example
│       └── README.md
├── proto/                        # gRPC 定義（.proto）
├── docs/                         # 仕様・設計・運用ドキュメント
│   ├── Phase1/                   # フェーズ別ドキュメント（必要に応じて追加）
│   └── ...
├── .walkthrough/                 # 作業経緯（事象/機能ごとの Markdown）
└── scripts/                      # 補助スクリプト（必要に応じて）
```

## Naming Conventions

### Files
- **Client components/modules**: `kebab-case`（例: `quiz-page.tsx`）
- **Client hooks/utilities**: `camelCase` を基本（例: `useQuiz.ts`、`dateUtils.ts`）
- **Proto**: `snake_case.proto`（例: `quiz_service.proto`）
- **Go packages**: `lowercase`（例: `quiz`, `question`, `auth`）
- **Tests**:
  - TypeScript: `*.test.ts` / `*.spec.ts`
  - Go: `*_test.go`

### Code
- **TypeScript**:
  - Types/Interfaces: `PascalCase`
  - Functions/Methods: `camelCase`
  - Constants: `UPPER_SNAKE_CASE`
- **Go**:
  - Exported: `PascalCase`
  - unexported: `camelCase`
  - Constants: `PascalCase` または `UPPER_SNAKE_CASE`（プロジェクト方針で統一）

## Import Patterns

### Import Order
1. 外部依存
2. 内部モジュール（絶対 import を採用する場合）
3. 相対 import

### Module/Package Organization
- Client（Remix）はドメイン（quiz, questions, me/auth 等）でフォルダを分割し、UI と通信層（gRPC 呼び出しラッパー）を分離する
  - バリデーションスキーマ（`zod`）は `client/app/` 配下に集約し、Remix の action/loader から利用する
  - フォームは `conform` を基本とし、フィールドエラーの表示方法を統一する
- Backend は `internal/` にドメインごとのパッケージを持ち、gRPC ハンドラは「薄く」しユースケースへ委譲する
  - DBアクセスは `pgx` 実装を基本とし、`backend/db/queries/` + `sqlc.yaml` を段階導入の入口として管理する
  - 論理削除（`deleted_at`）を採用するテーブルは、通常クエリで `deleted_at IS NULL` を標準とする（クエリの書き忘れを防ぐため、命名規約/テンプレート化も検討する）

## Code Structure Patterns

### Module/Class Organization
TypeScript（例）
1. imports
2. 型定義（DTO/Props 等）
3. main 実装
4. helper（必要最小限）
5. exports

Go（例）
1. package/import
2. 型定義
3. コンストラクタ
4. public メソッド
5. private helper

### Function/Method Organization
- 入力バリデーション（必要な場合）→ 権限/前提チェック → コア処理 → 永続化/外部呼び出し → 返却
- エラーは境界で変換する（gRPC の status と HTTP のステータスを混在させない）

### File Organization Principles
- 1ファイル 1責務（HTTP ハンドラ、サービス、リポジトリ、モデルは分離）
- ドメイン境界をまたぐ依存は「上位（ユースケース）→下位（リポジトリ）」に一方向にする

## Architecture Style

本プロジェクトはコンポーネントごとに、適した設計スタイルを使い分ける。

### Backend（Go）
- クリーンアーキテクチャ（ヘキサゴナル/オニオンに近い考え方）を採用する
- gRPC/DB/`sqlc` は外側（インフラ）として扱い、ユースケースとドメインを中心に置く
- 依存方向は「外側 → 内側」を徹底する

例（案）
```
backend/
├── cmd/
├── internal/
│   ├── transport/            # gRPC ハンドラ（薄く）
│   ├── usecase/              # アプリケーションサービス
│   ├── domain/               # ドメイン（エンティティ/不変条件）
│   ├── repository/           # リポジトリIF
│   └── infrastructure/       # DB/sqlc 実装、外部連携
├── db/
│   └── queries/
└── sqlc.yaml
```

### Client（Remix）
- レイヤード（route → service → client）を採用し、ルート（機能）単位で分割する
- ドメインロジックは持たず、入力検証（`zod` + `conform`）と境界処理に集中する

例（案）
```
client/
└── app/
    ├── routes/               # 画面（loader/action）
    ├── services/             # 入力検証、データ整形、gRPC 呼び出し
    ├── grpc/                 # gRPC クライアントラッパー（サーバー側でのみ使用）
    └── schemas/              # zod スキーマ（入力DTO）
```

補足
- gRPC クライアント（`@grpc/grpc-js`）は Node.js 向けのため、React コンポーネント等のブラウザ側コードから直接 import しない（loader/action 経由でのみ利用する）。
- gRPC→HTTP のエラー変換は共通モジュールとして切り出し、全ルートで同じ変換表を使う（変換表は `docs/tech.md` を単一の真実とする）。

## Code Organization Principles
1. **Single Responsibility**: ファイル/モジュールごとに責務を明確にする
2. **Modularity**: 再利用可能な単位に分割する（巨大なファイルを作らない）
3. **Testability**: I/O を境界に閉じ込め、ユースケースはテストしやすくする
4. **Consistency**: 既存の命名・フォルダ規約に合わせる（確定後は本書を更新）

## Module Boundaries
- **Client（Remix）**: 画面/SSR/入力、認証、入力検証、gRPC 呼び出し（BFF）
- **Backend**: 認可、出題/判定/履歴/作問のドメインロジック、DB アクセス
- **proto**: 契約の単一の真実（breaking change は手順を踏む）

## Code Size Guidelines
- **File size**: 300 行を目安に分割を検討（UI は例外が起きやすいので柔軟に）
- **Function/Method size**: 50 行を目安に分割を検討
- **Nesting depth**: 3 段以上のネストはリファクタリングを検討

## Documentation Standards
- `docs/`:
  - プロダクト: `docs/product.md`
  - 要件: `docs/requirements.md`
  - 設計: `docs/design.md`
  - 技術: `docs/tech.md`
  - 構造: `docs/structure.md`
- フェーズ別ドキュメントは `docs/PhaseN/` に配置する（運用で揃える）
- `.walkthrough/`:
  - 機能/事象ごとに Markdown を作成し、変更が入ったら追記/更新する
