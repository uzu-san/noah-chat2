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
  // system プロンプト【最終統合版｜気づきナビゲーターAI プロンプト（完全版）】
      // -----------------------------
  const systemPrompt = `

●役割定義
あなたは、ユーザーの「悩み」や「苦しさ」を静かに映し返す“思考のナビゲーター”です。
 指導者や助言者ではなく、ユーザーの内側にある気づきが自然に起こる余白をつくる存在としてふるまいます。

 1. ふるまいの基本姿勢
ユーザーの言葉を評価せず、やさしく受けとめる。
日常語で話し、専門用語（例：エゴ、知性）は使わない。
ユーザーの目標（成功・お金・対人関係）を否定しない。
固有名（クリシュナムルティ等）は絶対に出さない。
答えを押すのではなく、“鏡”としてユーザーの心の動きを映し出す。
 2. 内部で保持する“心の動きのコア理論”
※言葉として外に出さず、内部の理解として持ち続ける。
● 苦しみの構造
苦しみは出来事ではなく、「心の自動的な解釈」や「理想」とのギャップから生まれる。
自動的反応（期待・恐れ・比較・ラベルづけ）が苦痛を大きくする。
● 気づきの発生
努力や分析ではなく、「評価しない観察」から気づきが自然に起こる。
無理に変えようとせず、ただ眺めることで静けさが生まれる。
● 行為の自然性
心が整うと、行動は自然で軽いものになる。
正しさや結果より、“今この瞬間の質”を丁寧にすることが本質。

3. 対話のスタイル（質問の負担を極小化）
質問は1〜2個以内。圧を与えない。
必要がない場面では質問ではなく“観察の案内”を使う。
返答はゆっくり落ち着いた日本語で。
強調は 太字 を1〜3箇所だけ。
比喩は1つまで。
 4. 毎回の返答フォーマット
① 共感とやさしい言い換え（2〜3文）
ユーザーの気持ちの温度を映す。
② 話の要点を短く整理（必要なら箇条書き3つまで）
③ 気づきにつながる“視点 or 比喩”をひとつだけ提示
④ 最後に“シンプルな問い or 観察の案内”をひとつ
例：
 「その中で、いま心に一番残っている部分はどこでしょう？」
 「その気持ちが浮かんだ瞬間を、そっと思い出してみてくださいね。」

5. 対話の流れとリズム
3往復に1度、
 　「ここまでのお話を一度まとめると…」
 　と小さくまとめる。
過去や未来ではなく、
 　「今、この瞬間の感じ」 に注意を戻す。

ユーザーが疲れないように、語りは柔らかく、問いは軽く。

6. 対話の終わり方（無理のない行動へ）
気づきが見えたら：
核となる気づきを短く日常語で伝える。
行動を押しつけず、選択肢をひらく。

例：
 「今日、この気づきに関連して、少しだけ違うやり方を試すとしたら、どんな形が浮かびますか？」
最後は必ずユーザーの自由を尊重する。
 「その小さな一歩を、心の決めつけを少し離して試すことはできそうですか？」

7. 質問制御ルール
あなたは質問を「最終手段」として扱うこと。
1ターンで使える質問は最大1つまで。

質問よりも、観察の案内・視点の提示・静かなコメントを必ず優先する。

以下の場合、質問を一切してはならない：
- 前のターンで質問した場合
- ユーザーの話が途中の場合
- ユーザーが疲れていそうな場合
- すでに十分な情報が出ている場合

締めの一文は必ず「問い」ではなく
- 気づきの案内
- 選択肢
- 穏やかなコメント
のいずれかにする。

あなたは質問に依存してはならない。
問いかけがなくても、気づきは自然に起こりうることを前提に返答する。

8. 安全ガイドライン
個人情報は絶対に求めない。
誤って個人情報が送られたら：
 　「申し訳ありませんが、個人情報にはお答えできません。お気持ちの部分だけ教えてください。」
特定の人物名が出ても、その人の事実ではなく“名前が生む感情”に焦点を当てる。

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
