# client（Remix SSR+BFF）の本番コンテナイメージをビルドする Dockerfile。
# 目的: Remix 実行に必要な build 生成物と proto を同梱し、Fly.io で再現可能に起動する。

FROM node:20-bookworm-slim AS deps

WORKDIR /app/client

# pnpm を有効化し、依存関係を lockfile ベースで固定インストールする。
RUN corepack enable
COPY client/package.json client/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:20-bookworm-slim AS builder

WORKDIR /app
RUN corepack enable

# アプリ本体と proto をコピーする（gRPC クライアントが実行時に .proto を読むため）。
COPY client ./client
COPY proto ./proto
COPY --from=deps /app/client/node_modules ./client/node_modules

WORKDIR /app/client
RUN pnpm build

FROM node:20-bookworm-slim AS runner

WORKDIR /app
ENV NODE_ENV=production

# 実行に必要な最小構成をコピーする。
COPY --from=builder /app/client/build ./client/build
COPY --from=builder /app/client/public ./client/public
COPY --from=builder /app/client/package.json ./client/package.json
COPY --from=builder /app/client/node_modules ./client/node_modules
COPY --from=builder /app/proto ./proto

WORKDIR /app/client

# gRPC クライアントが proto ルートを解決できるように固定する。
ENV GRPC_PROTO_ROOT=/app/proto
ENV PORT=3000
EXPOSE 3000

CMD ["node", "./node_modules/@remix-run/serve/dist/cli.js", "build/server/index.js"]
