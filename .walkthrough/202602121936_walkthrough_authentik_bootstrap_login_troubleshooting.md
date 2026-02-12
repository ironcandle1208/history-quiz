# Walkthrough: Authentik Bootstrap ログイン不可のトラブルシューティング追記

## 背景
- `AUTHENTIK_BOOTSTRAP_EMAIL` / `AUTHENTIK_BOOTSTRAP_PASSWORD` を設定していても、管理画面ログインで `invalid password` になる問い合わせが発生した。

## 原因整理
- bootstrap 系環境変数は、Authentik の DB 初回初期化時に管理者ユーザーを作成する用途に限定される。
- 既存 DB（ボリューム）がある状態では、`.env` の bootstrap 値を変更しても既存管理者の資格情報は更新されない。

## 実施内容
- 更新: `docs/Phase1/local-development.md`
  - トラブルシューティングに以下を追加。
    - 症状（`invalid password`）
    - 原因（bootstrap 値は初回初期化時のみ有効）
    - 切り分け手順（`ps` / `logs` / `ak shell` で既存ユーザー確認）
    - 復旧手順
      - データ保持: `ak changepassword <username>`
      - 再初期化: `down -v` → `up -d`

## 検証
- 既存環境の調査結果（管理者が `akadmin` / `root@example.com` で存在）に沿った内容であることを確認。
- ドキュメント変更のみのため、アプリテストは未実施。
