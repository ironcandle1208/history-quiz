# Walkthrough: Remix の `client/public/build` をコミット対象から除外

## 目的
- ハッシュ付きビルド成果物（`client/public/build/*`）の差分ノイズをなくし、レビュー対象をソース変更に絞る。

## 実施内容

### 1. `.gitignore` 更新
- 更新: `.gitignore`
- 追加:
  - `client/public/build/`

### 2. 既存追跡ファイルの追跡解除
- 実行コマンド:
  - `git rm --cached -r client/public/build`
- 意図:
  - Git のインデックスからのみ削除し、ローカルファイル自体は保持する。

### 3. 除外設定の確認
- 実行コマンド:
  - `git check-ignore -v client/public/build/routes/login-NKASLE46.js`
- 結果:
  - `.gitignore` の `client/public/build/` ルールで無視されることを確認。

## 補足
- これ以降、`remix build` のたびに `client/public/build/*` が変更されても、原則コミット差分には出なくなる。
