// アプリ全体のレイアウト（Remix 標準）。
// 目的: 画面共通のナビゲーション、メタ情報、エラーハンドリングを一箇所に集約する。

import type { ReactNode } from "react";

import type { LinksFunction, MetaFunction } from "@remix-run/node";
import { Links, LiveReload, Meta, Outlet, Scripts, ScrollRestoration, Link } from "@remix-run/react";

import stylesheet from "./styles/app.css";

export const meta: MetaFunction = () => {
  return [{ title: "history-quiz" }, { name: "description", content: "歴史4択クイズ + 作問 + マイページ" }];
};

export const links: LinksFunction = () => {
  return [{ rel: "stylesheet", href: stylesheet }];
};

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <header className="header">
          <div className="header__inner">
            <Link to="/" className="brand">
              history-quiz
            </Link>
            <nav className="nav" aria-label="グローバルナビゲーション">
              <Link to="/quiz" className="nav__link">
                クイズ
              </Link>
              <Link to="/questions/new" className="nav__link">
                作問
              </Link>
              <Link to="/me" className="nav__link">
                マイページ
              </Link>
              <Link to="/login" className="nav__link">
                ログイン
              </Link>
            </nav>
          </div>
        </header>
        {children}
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <main className="main">
      <Outlet />
    </main>
  );
}
