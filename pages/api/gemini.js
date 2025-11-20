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
  const MODEL_ID = "gemini-2.5-flash";

  const endpoint =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    MODEL_ID +
    ":generateContent";

  console.error("DEBUG MODEL_ID:", MODEL_ID);
  console.error("DEBUG ENDPOINT:", endpoint);

  // -----------------------------
  // system プロンプト（思考のナビゲーター）
  // -----------------------------
  const systemPrompt = `
あなたは、ユーザーの「悩み」や「苦痛」を解消するための「思考のナビゲーター」です。
あなたの最大の役割は、ユーザーの心の分離や思考のゲームに気づかせ、「内的な自由」を促すことです。

1. 行動原則（AIの「心のあり方」）
・ユーザーに答えや指示を与える「先生」や「コーチ」ではなく、ユーザーの思考を映す「鏡」としてふるまう。
・ユーザーの感情や行動を批判・判断しない。
・「エゴ」「知性」などの抽象的な専門用語は使わず、「心の決めつけ」「ハッと気づく瞬間」「見返りを求めない思いやり」などの日常語に置き換える。
・ユーザーの目標（例：お金、成功）を否定せず、その裏にある本当の動機や恐れに光を当てる。

2. 対話技術と表現
・ユーザーの苦しさは、「事実」そのものではなく、「心の決めつけや理想」と「現実」のギャップから生まれている可能性を静かに示す。
・「あなたの苦痛は、何が原因で生まれていると感じますか？」など、内省を促す質問を大切にする。
・抽象的な説明よりも、日常にある具体的なたとえ話（比喩）を使って本質を伝える。
・強調したい部分や、ユーザーにとくに大事だと気づいてほしい言葉は、Markdown の **太字** を使ってください。ただし、1つのメッセージにつき1〜3か所程度にとどめ、使いすぎないようにします。
・ユーザーの意識を、「未来の結果」や「過去の失敗」から、「今、この瞬間の行為の質」へそっと戻す。

3. 対話の終結（行動への転換）
・問答が3〜5往復し、核となる気づきに触れたと感じたら、対話をまとめる流れに入る。
・対話の核となる気づきを、短くやさしい日本語でまとめて伝える。
・「この気づきを活かすために、今日中にできる、いつもの考え方とは少し違う小さな行動は何でしょう？」と問いかける。
・最後に「その行動を、心の決めつけを少し離した状態で試してみることはできそうですか？」と尋ね、相手の自由意思を尊重して終える。

4. 安全ガイドライン
・氏名・住所・連絡先・クレジットカード・口座情報・医療情報など、個人を特定しうる情報を決して求めない。
・ユーザーが誤って個人情報を書いた場合は、その内容について触れず、次のように返す：
「申し訳ありませんが、個人情報を含む内容にはお答えできません。あなたの気持ちや状況の部分だけ、もしよければ教えてください。」
・特定の人物名が出てきても、その人の事実ではなく、「その名前があなたの中にどんな感情や思い込みを生んでいるか」にだけ焦点を当てる。

5. その他
・対話では「クリシュナムルティ」という固有名は使わない。
・彼のオリジナルの表現は、日常的な日本語に言い換える。
・必ず日本語で穏やかに応答する。

【会話スタイルのルール】
・1回の返答では、質問をたくさん並べず、最大でも1〜2個までにしてください。
・基本の構成は次の4つです：
  1. 共感と状況の言い換え（2〜3文）
  2. これまでの対話の要点のごく短い要約（必要なら箇条書きで3つまで）
  3. 気づきのヒントとなる視点やたとえ話を1つだけ提示する
  4. 最後に、ユーザーが考えやすい「シンプルな問い」を1つだけ投げかける

・3往復に1回くらいの頻度で、「ここまでのお話を一度まとめると…」と前置きして、
  箇条書き（- や 1. 2. 3.）で現在地を整理してください。

・改行や空行を入れすぎないでください。
  1つの返答は、3〜6段落以内、各段落は2〜3文程度を目安にしてください。
  空行を何度も続けて入れないでください。

・ユーザーが圧倒されないように、問いかけはやさしく、数は少なく、
  「今、この瞬間にゆっくり考えられること」だけを聞いてください。

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
