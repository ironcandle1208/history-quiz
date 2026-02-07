// ブラウザ側のエントリポイント（Remix 標準）。
// NOTE: SSR と組み合わせて hydrate するため、ここは薄く保つ。

import { RemixBrowser } from "@remix-run/react";
import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <RemixBrowser />
    </StrictMode>,
  );
});

