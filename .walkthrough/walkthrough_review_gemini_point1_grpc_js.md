# Walkthrough: レビュー推奨事項(1) gRPC Web vs gRPC-JS の検討

## 対象
- `review/gemini_202512252140.md` の「3. 推奨事項・検討ポイント」(1)
  - gRPC Web vs gRPC-JS の選定について

## 結論
- 現在の構成（Remix が BFF を内包）では **gRPC は Remix サーバー（Node.js）からのみ呼び出す**方針が適切。
- そのため Remix 側の gRPC クライアントは **`@grpc/grpc-js`（gRPC-JS）**を採用する。

## 理由
- ブラウザから Backend（Go）を直接呼ぶ設計にすると、CORS/認証/公開API設計などの論点が一気に増える。
- BFF 構成では、gRPC をサーバー側に閉じ込めることで境界が明確になり、型安全（proto）と実装の単純さを両立できる。

## 注意点（運用/実装）
- `@grpc/grpc-js` は Node.js 向けのため、ブラウザバンドルに混入しないように import 経路を分離する（Remix の loader/action からのみ利用する）。

## 将来の拡張
- もし「ブラウザから直接 RPC を呼びたい」要件が出た場合は、以下を別途検討する。
  - gRPC-Web
  - Connect（ConnectRPC）
  - Backend 側に HTTP API を追加（BFF を維持しつつ段階導入も可能）

## 更新したドキュメント
- `docs/tech.md`: gRPC 呼び出し方針と `@grpc/grpc-js` 採用を明文化
- `docs/design.md`: gRPC 呼び出し方針（サーバー側のみ）を追記
- `docs/structure.md`: gRPC クライアントの配置/import ルール（サーバー側のみ）を追記
