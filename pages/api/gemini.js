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

  const userMessage = body?.message;
  if (!userMessage) {
    return res.status(400).json({ text: "No message provided" });
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

  // 必要最小限の payload（公式準拠）
  
const systemPrompt = `
あなたは、ユーザーの「悩み」や「苦痛」を解消するための「思考のナビゲーター」です。
あなたの役割は、ユーザーの心の決めつけやギャップに気づきをもたらし、内的な自由を促すことです。

【行動原則】
・判断しない、教えない、指示しない。「鏡」として機能する。
・専門用語を使わず、日常の表現に置き換える。
・目標を否定せず、その裏の動機や恐れへ光を当てる。

【対話技術】
・「その苦しさはどこから生まれていますか？」と内省を促す。
・日常の具体的なたとえ話で本質を示す。
・未来や過去ではなく「今、この瞬間の行為の質」に注意を戻す。

【終結】
・3〜5往復したら、気づきを短くまとめる。
・「今日中にできる、小さくて新しい行為は何ですか？」と行動につなげる。
・「内的な自由に基づいて、それを試してみますか？」と問いかける。

【禁止事項】
・個人情報を尋ねない・求めない。
・入力された場合は記憶せず、「個人情報には答えられない」と安全応答で内省に戻す。
・固有名詞の事実ではなく、その名前が生む感情や決めつけにだけ焦点を当てる。

※日本語のみで応答し、クリシュナムルティという言葉は使わず、彼の表現は日常語に言い換えてください。
`;

const payload = {
  contents: [
    // ① これが system 相当のプロンプト
    {
      role: "user",
      parts: [{ text: systemPrompt }],
    },
    // ② ここが実際のユーザーのメッセージ
    {
      role: "user",
      parts: [{ text: userMessage }],
    },
  ],
};


  try {
    const beforeFetch = Date.now();

    // -----------------------------
    // ① Gemini API へリクエスト
    // -----------------------------
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey, // 公式：URL ではなくヘッダー
      },
      body: JSON.stringify(payload),
    });

    const afterFetch = Date.now();

    // JSON 化
    const data = await response.json().catch((e) => {
      console.error("JSON parse error:", e);
      throw new Error("Invalid JSON from Gemini");
    });

    const afterJson = Date.now();

    // ------------------------------------------
    // ② ここが「503 専用メッセージ」を返す場所です
    // ------------------------------------------
    if (response.status === 503) {
      console.error("Gemini API overloaded (503).");

      return res.status(503).json({
        text:
          "現在AIサーバーが混雑しています。\n少し時間をおいて、もう一度お試しください。",
        status: 503,
      });
    }

    // 503 以外でエラーの場合
    if (!response.ok) {
      console.error("Gemini API error:", response.status, JSON.stringify(data));
      return res.status(500).json({
        text: "Gemini API error",
        status: response.status,
        detail: data,
      });
    }

    // ----------------------------------------
    // ③ 返信テキスト（parts の text）を取り出す
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
