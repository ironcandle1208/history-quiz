// 統合テスト実行時の対象ディレクトリと Node 環境を固定する設定。

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    clearMocks: true,
    environment: "node",
    include: ["app/tests/integration/**/*.test.ts"],
    mockReset: true,
    restoreMocks: true,
    setupFiles: ["app/tests/integration/setup.ts"],
  },
});
