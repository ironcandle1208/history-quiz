# client（Remix / SSR + BFF）

このディレクトリは Remix アプリを配置する。

## 役割
- ブラウザからの HTTP リクエストを受ける（SSR + BFF）
- 入力バリデーション（`zod` + `conform`）を行う
- サーバー側から gRPC でバックエンドへ委譲する（ブラウザから直接 gRPC は呼ばない）

## 注意
- `@grpc/grpc-js` は Node.js 向けのため、ブラウザバンドルへ混入しないようにする。
  - gRPC クライアントは `client/app/grpc/*.server.ts` のように **サーバ専用** で配置する想定。

