# backend の本番コンテナイメージをビルドする Dockerfile。
# 目的: Fly.io で再現可能に gRPC サーバーを起動できる状態を作る。

FROM golang:1.24-alpine AS builder

# HTTPS 通信（go mod download）に必要な CA 証明書を入れる。
RUN apk add --no-cache ca-certificates

WORKDIR /src

# 依存解決のキャッシュ効率を上げるため、先に go.mod/go.sum をコピーする。
COPY backend/go.mod backend/go.sum ./backend/
WORKDIR /src/backend
RUN go mod download

# backend ソース一式をコピーしてビルドする。
COPY backend/ .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /out/historyquiz-server ./cmd/server

FROM gcr.io/distroless/base-debian12

WORKDIR /app
COPY --from=builder /out/historyquiz-server /app/historyquiz-server

# Fly.io では PORT を環境変数で受け取り、未指定時はアプリ側デフォルトを使う。
ENV PORT=50051
EXPOSE 50051

ENTRYPOINT ["/app/historyquiz-server"]
