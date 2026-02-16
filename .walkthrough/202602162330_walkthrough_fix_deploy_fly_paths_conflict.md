# deploy-fly.yml の paths / paths-ignore 競合修正

## 発生事象
- GitHub Actions で `Invalid workflow file` が発生。
- エラー: `you may only define one of paths and paths-ignore for a single event`

## 原因
- `.github/workflows/deploy-fly.yml` の `on.push` で、同一イベントに `paths` と `paths-ignore` を同時定義していた。
- GitHub Actions の仕様で、同一イベントではどちらか一方のみ定義可能。

## 対応内容
- `paths-ignore` を削除。
- `paths` に否定パターン（`!`）を追加して除外条件を維持。
  - `!backend/**/*_test.go`
  - `!client/tests/**`
  - `!.walkthrough/**`
- 将来の再発防止のため、該当箇所に仕様意図のコメントを追加。

## 変更ファイル
- `.github/workflows/deploy-fly.yml`
- `.walkthrough/<timestamp>_walkthrough_fix_deploy_fly_paths_conflict.md`

## 期待効果
- Workflow 構文エラーが解消され、`deploy-fly` が有効化される。
- 既存のトリガー対象/除外対象の意図は維持される。
