# Phase1 セキュリティチェックリスト（最終確認）

## 目的
- Phase1 の実装が、`docs/tech.md` のセキュリティ方針（認証/認可/入力/エラー）に一致しているかを最終確認する。
- リリース前に同じ観点で再確認できる実務チェックリストとして残す。

## 実施サマリ（2026-02-14）
- 判定: 重大な未対応は確認されず、Phase1 範囲としては運用可能。
- 追加対応候補: CSRF トークンの明示導入（現状は `SameSite=Lax` と OIDC `state` で防御）。

## チェックリスト（認証）
| ID | チェック項目 | 確認方法 | 結果 | 根拠 |
|---|---|---|---|---|
| AUTH-01 | セッションCookieが `HttpOnly` / `SameSite` / `Secure(本番)` を設定している | `client/app/services/session.server.ts` の Cookie 定義確認 | OK | `secure: process.env.NODE_ENV === "production"`、`httpOnly: true`、`sameSite: "lax"` |
| AUTH-02 | `SESSION_SECRET` が本番で必須化されている | `resolveSessionSecrets` の分岐確認 | OK | `production` かつ未設定時は例外で起動失敗 |
| AUTH-03 | OIDC コールバックで `state` を検証している | `client/app/routes/auth.callback.tsx` を確認 | OK | `state !== pendingAuth.state` で 401 返却 |
| AUTH-04 | OIDC で `nonce` / `issuer` / `audience` / `exp` / 署名検証を実施している | `client/app/services/oidc.server.ts` を確認 | OK | `validateIdTokenClaims` と `verifyIdTokenSignature` 実装あり |
| AUTH-05 | Open Redirect を防止している | `sanitizeRedirectTo` の利用箇所確認 | OK | 外部URL/`//` を拒否し内部パスのみ許可 |

## チェックリスト（認可）
| ID | チェック項目 | 確認方法 | 結果 | 根拠 |
|---|---|---|---|---|
| AUTHZ-01 | `/me`・`/questions/new`・`/questions/:id/edit` が未認証でログインへ誘導される | 各 route の loader/action で `requireAuthenticatedUser` を確認 | OK | `client/app/routes/me.tsx`、`client/app/routes/questions.new.tsx`、`client/app/routes/questions.$id.edit.tsx` |
| AUTHZ-02 | gRPC 側でも認証必須メソッドを強制する（二重防御） | `allowAnonymousMethods` と interceptor を確認 | OK | `backend/internal/transport/grpc/server.go` で Quiz 以外は認証必須 |
| AUTHZ-03 | 所有者チェックがバックエンドで実施される | Question 更新処理とリポジトリ条件を確認 | OK | `backend/internal/usecase/question/service.go` で `authorUserID != userID` を拒否 |
| AUTHZ-04 | DB クエリがユーザー単位に分離されている | `ListMyQuestions` / `ListMyAttempts` / `GetMyStats` の SQL を確認 | OK | `WHERE author_user_id = $1`、`WHERE user_id = $1` |

## チェックリスト（入力検証）
| ID | チェック項目 | 確認方法 | 結果 | 根拠 |
|---|---|---|---|---|
| INP-01 | Remix 側で zod による一次検証を行っている | 問題作成/編集/回答 action を確認 | OK | `parseWithZod(...)` を各 route で実施 |
| INP-02 | Backend 側で最終検証（必須/形式/整合性）を行っている | Question/Quiz/User の usecase を確認 | OK | UUID 検証、4択制約、所属チェックを usecase で検証 |
| INP-03 | DB でも不変条件を担保している | migration 定義を確認 | OK | `choices ordinal` 制約、複合 FK、4択制約トリガー |

## チェックリスト（エラー/観測性）
| ID | チェック項目 | 確認方法 | 結果 | 根拠 |
|---|---|---|---|---|
| ERR-01 | gRPC→HTTP 変換が共通化され、`UNAUTHENTICATED=401` / `PERMISSION_DENIED=403` になる | 変換マップを確認 | OK | `client/app/services/grpc-error.server.ts` |
| ERR-02 | エラーレスポンスに `requestId` を含め、追跡可能である | 共通エラー生成と route 応答を確認 | OK | JSON payload と `x-request-id` header を返却 |
| ERR-03 | 内部エラー時に過度な内部情報を露出しない | ユーザー向けメッセージ生成を確認 | OK | `INTERNAL/UNKNOWN/DATA_LOSS` は固定メッセージ |

## 最終確認コマンド（2026-02-14 実行）
- `GOCACHE=$(pwd)/.cache/go-build go test ./internal/usecase/question ./internal/usecase/user ./internal/usecase/quiz ./internal/transport/grpc/interceptors`（`backend/`）: pass
- `pnpm --dir client exec vitest run` : pass（integration 3件）

## 運用メモ（Phase1）
1. リリース前チェックは本ファイルの `AUTH-* / AUTHZ-* / INP-* / ERR-*` を全項目確認し、結果を更新する。
2. 障害調査時は `requestId`（レスポンスヘッダ/本文）を起点に Remix と Backend のログを突合する。
3. Phase2 では CSRF トークン導入（状態変更 POST 全般）を優先検討する。
