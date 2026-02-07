# Walkthrough: レビュー推奨事項(3) エラーハンドリングの共通化（gRPC→HTTP）

## 対象
- `review/gemini_202512252140.md` の「3. 推奨事項・検討ポイント」(3)
  - gRPC ステータスコードから HTTP ステータスへの変換ルールを早期に定義する

## 結論（方針）
- gRPC（Backend）と HTTP（Remix）の境界で、**ステータス変換表**と**エラーレスポンス形式**を標準化する。
- 変換表は `docs/tech.md` の `Error Handling Standards` を単一の真実とする。
- 相関ID（`x-request-id` 等）を HTTP と gRPC metadata で伝播し、調査容易性を上げる。

## 更新したドキュメント
- `docs/tech.md`: `Error Handling Standards`（変換表、レスポンス形式、相関ID）を追加
- `docs/design.md`: `Error Handling` に「標準は tech.md を参照」を追記
- `docs/structure.md`: エラー変換を共通モジュールとして切り出す方針を追記
