// トップページ（暫定）。
// NOTE: ナビゲーションは root.tsx に置き、ここは画面固有の内容に限定する。

import { Link } from "@remix-run/react";

export default function IndexRoute() {
  return (
    <section className="card">
      <h1>history-quiz</h1>
      <p className="muted">クイズを解く / 問題を作る / 学習履歴を見る（Phase1）</p>

      <ul>
        <li>
          <Link to="/quiz">クイズを始める</Link>
        </li>
        <li>
          <Link to="/questions/new">問題を作る</Link>
        </li>
        <li>
          <Link to="/me">マイページを見る</Link>
        </li>
      </ul>
    </section>
  );
}
