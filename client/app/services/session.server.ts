// Cookie セッションを扱う（サーバー専用）。
// NOTE: Remix の session API に依存するため、Remix 初期化後に動作確認する。

export type SessionUser = {
  // Phase1 は userId = OIDC sub の前提（docs/Phase1/decisions.md）
  userId: string;
};

// requireUser は「ログイン必須」のルートで user を取得する。
// 未ログインの場合はログインへ誘導する（リダイレクト方針は後続で確定）。
export async function requireUser(): Promise<SessionUser> {
  // TODO: Remix の getSession を用いて Cookie から userId を復元する
  throw new Error("未実装: requireUser");
}

