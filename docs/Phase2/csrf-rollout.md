# Phase2 CSRF ロールアウト

## 概要
- 実施日: 2026-02-14
- 目的: Remix の状態変更系 `POST action` に対して CSRF 防御を明示導入し、トークン欠落/改ざん時は `403` を返す。
- 方針: セッション単位でトークンを発行し、フォーム hidden input で送信、action 冒頭で検証する。

## 実装内容

### 1. 共通サービス追加
- 追加: `client/app/services/csrf.server.ts`
- 提供機能:
  - `issueCsrfToken(request)`
    - セッションに CSRF トークンが無ければ生成して保存
    - 初回のみ `Set-Cookie` を返却
  - `verifyCsrfToken({ request, formData, requestId? })`
    - セッション値と送信値を比較
    - 不一致時は `403` + `x-request-id` + JSON エラーを throw
- 追加: `client/app/services/session.server.ts`
  - `csrfToken` のセッションキー
  - `getSessionCsrfToken` / `ensureSessionCsrfToken` を追加

### 2. 保護対象 POST action
以下の全 `POST` で検証を必須化。

1. `client/app/routes/login.tsx`（ログアウト）
2. `client/app/routes/quiz.tsx`（回答送信）
3. `client/app/routes/questions.new.tsx`（問題作成）
4. `client/app/routes/questions.$id.edit.tsx`（問題更新）

各 route の loader で `csrfToken` を返却し、フォームに hidden input（`name=csrfToken`）を追加した。

### 3. エラー仕様
- ステータス: `403`
- レスポンス形式:

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "セキュリティ検証に失敗しました。ページを再読み込みして再試行してください。"
  },
  "requestId": "<request-id>"
}
```

- ヘッダー: `x-request-id`

## テスト
- 追加: `client/app/tests/integration/csrf.server.integration.test.ts`
  - 正常系: 同一セッションでトークン再利用
  - 正常系: 一致トークンで検証成功
  - 異常系: 不一致トークンで `403` + `requestId`
- 既存 integration/e2e は CSRF サービスをモックし、既存導線検証の意図を維持。

## 運用メモ
- 今後 `POST action` を追加する場合は、必ず以下を同時に実装する。
1. loader で `issueCsrfToken` を呼ぶ
2. form に `csrfToken` hidden input を含める
3. action 冒頭で `verifyCsrfToken` を実行する
