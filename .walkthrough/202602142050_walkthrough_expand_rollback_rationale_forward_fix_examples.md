# Rollback方針の採用理由詳細化とforward fix例の追記

## 実施日時
- 2026-02-14 20:50

## 背景
- `docs/Phase2/migration-operations.md` のロールバック方針は要点のみで、採用理由の背景と実務での適用例が不足していた。
- 方針説明をチーム内で再利用しやすくするため、理由の明文化と具体例の追加が必要だった。

## 変更内容
1. `4.1 採用理由（詳細）` を追加
- `down migration` の非可逆リスク
- 履歴/統計データ保全の優先
- 障害時判断の単純化
- 環境間再現性の維持
- 緊急時は Neon 復元が有効なケース

2. `4.2 forward fix 適用例` を追加
- 制約違反データ補正後の再適用
- 型変更時の段階移行
- インデックス改善の安全な切り替え
- nullable/non-null の段階修正
- 誤デフォルト値のデータ修復

3. `4.3 適用判断の目安` を追加
- forward fix と Neon 復元の使い分け基準を3パターンで整理

## 意図
- 「なぜこの方針か」と「実際にどう使うか」を同一ドキュメントで説明し、運用判断の迷いを減らす。
- インシデント時に短時間で意思決定できるように、判断基準を明示する。

## 変更ファイル
- `docs/Phase2/migration-operations.md`
- `.walkthrough/202602142050_walkthrough_expand_rollback_rationale_forward_fix_examples.md`
