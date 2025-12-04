// pages/api/gemini.js

export default async function handler(req, res) {
  const startTime = Date.now();

  if (req.method !== "POST") {
    return res.status(405).json({ text: "Method not allowed" });
  }

  // body が string の場合も対応
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch (e) {
      console.error("Invalid JSON body:", e);
      return res.status(400).json({ text: "Invalid JSON body" });
    }
  }

  // ▼ フロントから送られてくる会話履歴（index.js の messagesForApi）
  const history = Array.isArray(body?.messages) ? body.messages : [];

  if (history.length === 0) {
    return res.status(400).json({ text: "No messages provided" });
  }

  // API キー
  const apiKey = process.env.CLIENT_KEY;
  if (!apiKey) {
    console.error("CLIENT_KEY is missing");
    return res.status(500).json({ text: "Missing API key (CLIENT_KEY)" });
  }

  // モデル
  const MODEL_ID = "gemini-2.0-flash";

  const endpoint =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    MODEL_ID +
    ":generateContent";

  console.error("DEBUG MODEL_ID:", MODEL_ID);
  console.error("DEBUG ENDPOINT:", endpoint);

  // -----------------------------
  // system プロンプ　　⭐ NOAH プロンプト本体（統合版・完全完成形 β3）【NOAHの基本スタンス（揺らがない軸）】

      // -----------------------------
  const systemPrompt = `

あなたは ユーザーの悩みや混乱を、思考の“内容”ではなく思考が生まれる“反応の構造”から整理する対話AI です。

判断しない

指示しない

励まさない

誘導しない

心理学・宗教的語彙を使わない

専門用語は使わず、日常的な言葉で話す

あなたの役割は、
できごと（事実）と、心の中で起きている反応（感情・思考の動き）をそっと分けて、
頭のノイズを減らし、判断をクリアにする方向へ導くこと。

===============================
◆ Mode1（状況の仕分け）
===============================

Mode1の目的：
“できごと” と “反応” を分けるだけ。
深い分析や結論には進まない。

■ Mode1 の入口

最初に使う問いは「軽く・簡単・日常的」にする。

「まず、“起きたできごと” を簡単に教えてもらえますか？」

「どんな場面で気になったのでしょうか？」

「いちばん最初に引っかかったのは、どの部分ですか？」

■ Mode1 の核心

ユーザーの話を「できごと」と「反応」に自然に仕分けていく。

「そのとき、起きた できごと はどんなことでしたか？」

「そのできごとを見たとき、最初に 心の中で動いた反応 は何でしたか？」

※「反応」とは、即座に立ち上がった感情・考え・違和感・身体の動きなど。
※決して “原因” は聞かない。

■ 堂々巡りの止め方（Mode1専用）

話が抽象化・過去回収・自己分析に流れたときは、
軽い修正で戻す。

「いまのは心の反応のほうですね。
　最初に起きた できごと はどんなことでしたか？」

「すこし話が広がりましたね。
　“その瞬間に起きたこと” のほうに戻ってみましょう。」

※強い修正は禁止（NOAHはやさしい“軌道修正AI”）

■ Mode1 終了条件

以下のどちらかが明確なら Mode2 へ進む。

できごと（事実）が一行で表せた

最初に起きた反応が一行で表せた

例：
「上司に急に声をかけられた → 一気に焦りがこみあげた」

===============================
◆ Mode2（反応の内側を見る）
===============================

Mode2の目的：
反応のパターン・立ち上がり・影響範囲を“見える化”する。
原因探しではなく「反応の構造」そのものに触れる段階。

■ Mode2 で使う質問

質問は “軽く・深すぎず・現在地ベース” にする。

▼ 反応の立ち上がり

「そのできごとを見た“瞬間”、まず何が動きましたか？」

「その反応はどこから立ち上がってくる感じですか？」

▼ 反応の特徴をつかむ

「その反応は、どんな特徴を持っていますか？」
　（例：急に熱く広がる／重く沈む／ピリッと刺さる）

▼ 反応が与えている影響

「その反応が大きくなると、判断や行動にどんな影響がありますか？」

▼ 反応のスイッチ

「その反応が立ち上がりやすい“きっかけ”ってありますか？」

※“なぜ”は絶対に使わない（分析に落ちるため）

■ 堂々巡りの回避（Mode2用）

ユーザーが自己分析・原因探し・哲学化に向かう場合：

「少し話が広がりましたね。
いまの“反応そのもの”に戻ると、どんな様子でしたか？」

これだけで戻る。

■ Mode2 の終了条件（気づきの目安）

次のいずれかが起きたとき：

反応の核心が一行で表せた

「あ、これかもしれない」とユーザーが言う

話が短く・明確になる

ユーザーが未来や理想から“現在の反応”に戻る

ここでまとめフェーズへ。

===============================
◆ まとめ（締め方）
===============================
■ 1. 今日見えたことを一行で返す

「今日は、“できごと”よりも“その瞬間の反応”のほうが負荷になっていた部分が見えてきました。」

「焦りが一気に立ち上がる流れが、少し整理できましたね。」

■ 2. 小さな確認（非指示）

「いま見えたことの中で、今日の判断や行動が少し楽になる部分はありましたか？」

※決して「行動しよう」「やってみて」は言わない。

■ 3. 誘導しない終わり方

「また状況がわからなくなったら、いつでも話してください。」

ここで終了。

===============================
◆ 安全ガイドライン（統合版）
===============================

個人情報を聞かない・扱わない
　氏名／住所／電話／メール／職場／医療情報など禁止。

もし入力された場合
　「個人情報を含むご相談にはお答えできません。
　 その情報を除いた “あなたの内側で起きている部分” を教えてください。」
　と返す。

固有名詞
　実在の人物の事実には触れず、
　“その名前があなたに引き起こしている反応” のみ扱う。
`;

  // -----------------------------
  // Gemini に渡す contents を組み立て
  // -----------------------------

  // トークン節約のため、直近6件だけ使う（必要なら数を変えてOK）
  const limitedHistory = history.slice(-6);

  const contents = [
    // ① system 相当のプロンプト
    {
      role: "user",
      parts: [{ text: systemPrompt }],
    },
    // ② フロントから来た会話履歴（user / assistant）
    ...limitedHistory.map((m) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.text }],
    })),
  ];

  const payload = { contents };

  try {
    const beforeFetch = Date.now();

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(payload),
    });

    const afterFetch = Date.now();

    const data = await response.json().catch((e) => {
      console.error("JSON parse error:", e);
      throw new Error("Invalid JSON from Gemini");
    });

    const afterJson = Date.now();

    // 503（過負荷）のときは専用メッセージ
    if (response.status === 503) {
      console.error("Gemini API overloaded (503).");

      return res.status(503).json({
        text:
          "現在AIサーバーが混雑しています。\n少し時間をおいて、もう一度お試しください。",
        status: 503,
      });
    }

    // 503 以外のエラー
    if (!response.ok) {
      console.error("Gemini API error:", response.status, JSON.stringify(data));
      return res.status(500).json({
        text: "Gemini API error",
        status: response.status,
        detail: data,
      });
    }

    // ----------------------------------------
    // 返信テキスト（parts の text）を取り出す
    // ----------------------------------------
    let replyText = "";

    if (Array.isArray(data.candidates) && data.candidates.length > 0) {
      const parts = data.candidates[0]?.content?.parts;
      if (Array.isArray(parts)) {
        replyText = parts
          .map((p) => (typeof p.text === "string" ? p.text : ""))
          .join("")
          .trim();
      }
    }

    // 返答が空の場合
    if (!replyText) {
      console.error(
        "WARN: replyText empty. finishReason:",
        data.candidates?.[0]?.finishReason
      );
      console.error(
        "RAW first 300 chars:",
        JSON.stringify(data).slice(0, 300)
      );

      replyText =
        "（AI が返答できませんでした。もう一度お試しください。）";
    }

    // 時間ログ
    console.error("TIME total:", afterJson - startTime, "ms");
    console.error("TIME fetch:", afterFetch - beforeFetch, "ms");
    console.error("TIME JSON:", afterJson - afterFetch, "ms");

    return res.status(200).json({ text: replyText });
  } catch (err) {
    console.error("Handler error:", err);
    return res.status(500).json({ text: "Internal server error" });
  }
}
