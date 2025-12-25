# Walkthrough: docs/design.md 作成

## 目的
- `docs/requirements.md` と `docs/product.md` を読み取り、システム全体の責務分離（Client / APIGateway / Go Backend）とデータモデル、インターフェース、エラーハンドリング、テスト方針を `docs/design.md` として整理する。

## 参照した資料
- `docs/requirements.md`
- `docs/product.md`
- `.spec-workflow/templates/design-template.md`

## 進め方
1. 要件（機能・非機能）から、必須のコンポーネント（クイズ、作問、マイページ、認証）を抽出した。
2. 通信方式要件（HTTP/JSON と gRPC）を軸に、APIGateway とバックエンドの責務境界を定義した。
3. データモデルを「問題」「選択肢」「正解」「解答履歴」に分解し、認可（ユーザー自身のデータのみ）の前提を明確化した。
4. 想定エラーとユーザー影響を整理し、テスト戦略（Unit/Integration/E2E）を最低限定義した。

## 出力
- `docs/design.md`

## メモ
- `docs/tech.md` / `docs/structure.md` は未整備のため、`docs/design.md` では暫定方針として記述している。整備後に差分吸収（設計の再整合）を行う。
- `docs/Phase1/` 配下のドキュメント配置は現状の `docs/requirements.md` に合わせた（フェーズ分割は今後の運用で揃える）。

## 更新履歴
- 2025-12-23: Web のみ想定となったため、別サービスの APIGateway を廃止し、Remix（SSR + BFF）に内包する方針へ設計を更新。
