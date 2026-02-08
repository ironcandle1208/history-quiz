# Walkthrough: Task24 マイページ（履歴/正答率/自作問題一覧/空状態）

## 目的
- `docs/tasks.md` の Task24 を実装し、`/me` で学習進捗と作問管理情報を確認できるようにする。
- 未認証時のリダイレクト、gRPC エラーの共通変換、空状態メッセージを一貫して扱う。

## 実装内容

### 1. `/me` loader を本実装へ更新
- 更新: `client/app/routes/me.tsx`
- 実装した内容:
  - `requireAuthenticatedUser` でログイン必須化
  - `createRequestId` でページ単位の requestId を生成
  - 以下の gRPC を `Promise.all` で並列呼び出し
    - `ListMyAttempts`
    - `GetMyStats`
    - `ListMyQuestions`
  - gRPC 失敗時は `throwGrpcErrorResponse` で共通エラーレスポンス化

### 2. マイページ UI を要件に合わせて実装
- 更新: `client/app/routes/me.tsx`
- 表示セクション:
  - 学習統計（解答数 / 正解数 / 正答率）
  - 解答履歴一覧（問題文・正誤・回答日時）
  - 自作問題一覧（編集リンク・更新日時）
- 空状態:
  - 履歴なし: 「まだ解答履歴がありません...」
  - 自作問題なし: 「まだ作成した問題がありません...」

### 3. エラーバウンダリを追加
- 更新: `client/app/routes/me.tsx`
- 実装した内容:
  - `isRouteErrorResponse` でエラーペイロードからメッセージと `requestId` を復元
  - `/me` 再試行リンクを表示

### 4. タスク管理更新
- 更新: `docs/tasks.md`
- `Task24` を `[ ]` から `[x]` に更新

## 検証
- 実行: `pnpm -C client exec tsc --noEmit`
- 結果: 型エラーなし
