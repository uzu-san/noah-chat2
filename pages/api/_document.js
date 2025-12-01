// pages/_document.js
import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="ja">
      <Head>
        {/* スマホ用の設定（これがないとPC画面の縮小になる） */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1"
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
