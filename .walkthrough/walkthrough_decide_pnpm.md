# Walkthrough: Client のパッケージマネージャーを pnpm に決定

## 背景
- Client は Remix（TypeScript）を採用し、依存パッケージ（UI、フォーム、OIDC 等）が増えやすい。
- 依存解決の一貫性とインストール速度を重視したい。

## 決定
- Client のパッケージマネージャーは `pnpm` を採用する。
- Backend（Go）は従来どおり `go mod` を利用する。

## 更新したドキュメント
- `docs/tech.md`: `Package Management` を `pnpm（Client）` に更新
