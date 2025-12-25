package main

import (
	"log"
	"net"
	"os"

	grpcserver "github.com/history-quiz/historyquiz/internal/transport/grpc"
)

// main は gRPC サーバーを起動するエントリポイント。
// NOTE: 本実装は骨格のみで、サービス登録は後続タスク（proto 生成後）で追加する。
func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "50051"
	}

	lis, err := net.Listen("tcp", ":"+port)
	if err != nil {
		log.Fatalf("listen failed: %v", err)
	}

	s := grpcserver.NewServer()

	log.Printf("gRPC server listening on :%s", port)
	if err := s.Serve(lis); err != nil {
		log.Fatalf("serve failed: %v", err)
	}
}

