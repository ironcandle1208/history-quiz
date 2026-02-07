# Walkthrough: アーキテクチャスタイルの決定（Clean + Layered）

## 背景
- 構成は `Remix（SSR + BFF）` と `Go Backend（gRPC）` に分割している。
- 入力検証は Remix 側で UX を重視しつつ、Backend 側で整合性/認可の最終防衛を行う方針。
- DB アクセスは `sqlc` を採用し、生SQLと生成コードを境界に置きたい。

## 決定
- **Go Backend** はクリーンアーキテクチャ（ヘキサゴナル/オニオンに近い）を採用する。
- **Remix（BFF）** はレイヤード（route → service → client）を採用し、ルート（機能）単位で分割する。

## ねらい
- Backend は「ビジネスルールを守る」ことを最優先にし、外部要因（gRPC/DB）から独立してテストしやすくする。
- Remix は「画面/フォーム/境界処理」に集中し、ドメインロジックを持たないことで肥大化を防ぐ。

## 更新したドキュメント
- `docs/design.md`: `Architecture Style` と層の依存方向を追記
- `docs/structure.md`: `Architecture Style` と推奨ディレクトリ構成例を追記
