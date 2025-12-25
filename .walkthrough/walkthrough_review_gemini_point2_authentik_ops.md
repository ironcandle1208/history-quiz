# Walkthrough: レビュー推奨事項(2) Authentik の運用コスト（リソース/バックアップ）検討

## 対象
- `review/gemini_202512252140.md` の「3. 推奨事項・検討ポイント」(2)
  - Fly.io 上での Authentik 運用における、Postgres/Redis のリソース管理とバックアップ計画の確定

## 結論（方針）
- Authentik は Fly.io 上で運用し、**Authentik 用の Postgres/Redis はアプリDB（Neon）とは分離**して用意する。
- バックアップ対象は **Postgres を中心**に据える（Authentik の永続データがあるため）。
- **自動バックアップ（スナップショット）を最低限**とし、必要に応じて **論理バックアップ（pg_dump）を別ストレージへ保管**する。
- 設定（OIDC Provider / Application / Flow 等）は **Blueprints 等でコード化**し、復旧時の手戻りを減らす。

## リソース管理の考え方
- Authentik 本体/DB/Redis をそれぞれ独立に監視し、最小構成から開始して不足が見えたらスケールする。

## 更新したドキュメント
- `docs/tech.md`: `Authentik Ops（リソース管理とバックアップ）` を追記
- `infra/authentik/README.md`: バックアップ/復元のメモと、設定コード化（Blueprints）を追記
- `docs/design.md`: Authentik コンポーネントに運用参照を追記
