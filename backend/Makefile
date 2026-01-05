.PHONY: test test-cover test-coverprofile clean-go-cache help

# Go のキャッシュ/一時ディレクトリを backend 配下に寄せる。
# 目的: 環境によってはデフォルトの Go キャッシュ先（例: ~/Library/Caches/go-build）に書き込めず失敗するため。
GOCACHE_DIR := $(CURDIR)/.gocache
GOTMP_DIR := $(CURDIR)/.gotmp

help:
	@echo "使い方:"
	@echo "  make test             # 通常のテスト（全パッケージ）"
	@echo "  make test-cover        # カバレッジ表示付き"
	@echo "  make test-coverprofile # coverprofile を coverage.out に出力"
	@echo "  make clean-go-cache    # backend/.gocache と backend/.gotmp を削除"

test:
	@mkdir -p "$(GOCACHE_DIR)" "$(GOTMP_DIR)"
	@GOCACHE="$(GOCACHE_DIR)" GOTMPDIR="$(GOTMP_DIR)" go test ./...

test-cover:
	@mkdir -p "$(GOCACHE_DIR)" "$(GOTMP_DIR)"
	@GOCACHE="$(GOCACHE_DIR)" GOTMPDIR="$(GOTMP_DIR)" go test ./... -cover

test-coverprofile:
	@mkdir -p "$(GOCACHE_DIR)" "$(GOTMP_DIR)"
	@GOCACHE="$(GOCACHE_DIR)" GOTMPDIR="$(GOTMP_DIR)" go test ./... -coverprofile=coverage.out
	@echo "coverage.out を HTML で確認する場合:"
	@echo "  go tool cover -html=coverage.out -o coverage.html"

clean-go-cache:
	@rm -rf "$(GOCACHE_DIR)" "$(GOTMP_DIR)"

