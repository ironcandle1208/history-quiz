# Walkthrough: Task17 Remix 初期化 + 基本ルーティング

## 目的
- `docs/tasks.md` の Task17（Remix アプリ初期化、基本ルーティング作成）を進める。
- 以降のタスク（セッション/OIDC/gRPC 接続）を載せられる「動く骨格」を用意する。

## 実施内容
- Remix の標準エントリポイントとルートレイアウトを追加した。
  - `client/app/root.tsx`
  - `client/app/entry.client.tsx`
  - `client/app/entry.server.tsx`
- 画面のルーティング骨格として、対象ルートに `loader/action` のスタブを追加した（後続タスクで置換する前提）。
  - `/quiz`（`client/app/routes/quiz.tsx`）
  - `/questions/new`（`client/app/routes/questions.new.tsx`）
  - `/questions/:id/edit`（`client/app/routes/questions.$id.edit.tsx`）
  - `/me`（`client/app/routes/me.tsx`）
  - `/login`（`client/app/routes/login.tsx`）
- 共通ナビゲーション（ヘッダー）と最小限のスタイルを追加した。
  - `client/app/styles/app.css`
- TypeScript で CSS import を扱えるように型定義を追加した。
  - `client/app/types.d.ts`
- `client/public/` が空でもディレクトリ構造を維持できるようにプレースホルダを追加した。
  - `client/public/.gitkeep`

## 追加/更新した設定
- `client/package.json` に Remix/React の依存を追加した。
- `client/remix.config.js` を追加した（ビルド成果物の配置を定義）。

## 動作確認メモ
- 依存関係のインストールが済んでいない場合は、`client/` 配下でパッケージのインストールが必要。
- `client/app/entry.server.tsx` は Node.js のストリームを `Response` に渡すため、`createReadableStreamFromReadable` で Web Stream に変換する（TypeScript の型エラー回避も兼ねる）。
- 後続タスクで以下を実装すると、スタブを実処理へ差し替えできる。
  - Task18: セッション（Cookie）とログインガード
  - Task19: Authentik（OIDC）連携
  - Task20: gRPC クライアント（サーバ専用）
  - Task21: gRPC→HTTP エラー変換の統一適用
