// pages/api/gemini.js

export default async function handler(req, res) {
  const startTime = Date.now();

  if (req.method !== "POST") {
    return res.status(405).json({ text: "Method not allowed" });
  }

  // body が string でも object でも対応
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

  // 環境変数から API キー取得
  const apiKey = process.env.CLIENT_KEY;
  if (!apiKey) {
    console.error("CLIENT_KEY is missing");
    return res.status(500).json({ text: "Missing API key (CLIENT_KEY)" });
  }

  const MODEL_ID = "gemini-2.5-flash"; // 公式どおり
  const endpoint =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    MODEL_ID +
    ":generateContent";

  console.error("DEBUG MODEL_ID:", MODEL_ID); // APIキーは出さない
  console.error("DEBUG ENDPOINT:", endpoint.replace(apiKey, "***"));

  // 公式サンプルに合わせた最小 payload
  const payload = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text:
              userMessage +
              "\n\n※日本語で、できるだけ短く（3〜5文程度）答えてください。",
          },
        ],
      },
    ],
    // いったん maxOutputTokens は指定しない
    // generationConfig: { ... } をどうしても使いたくなったら後で追加
  };

  try {
    const beforeFetch = Date.now();

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey, // ✅ 公式どおりヘッダーで渡す
      },
      body: JSON.stringify(payload),
    });

    const afterFetch = Date.now();

    const data = await response.json().catch((e) => {
      console.error("JSON parse error:", e);
      throw new Error("Invalid JSON from Gemini");
    });

    const afterJson = Date.now();

    if (!response.ok) {
      console.error("Gemini API error:", response.status, JSON.stringify(data));
      console.error("TIME total (error):", Date.now() - startTime, "ms");
      console.error("TIME fetch (error):", afterFetch - beforeFetch, "ms");
      return res.status(500).json({
        text: "Gemini API error",
        status: response.status,
        detail: data,
      });
    }

    // ---- ここがテキスト取り出しの「コア」 ----
    let replyText = "";

    // SDK と同じく data.text があれば最優先
    if (typeof data.text === "string" && data.text.trim()) {
      replyText = data.text.trim();
    } else if (Array.isArray(data.candidates) && data.candidates.length > 0) {
      const parts = data.candidates[0]?.content?.parts;
      if (Array.isArray(parts)) {
        replyText = parts
          .map((p) => (typeof p.text === "string" ? p.text : ""))
          .join("")
          .trim();
      }
    }

    if (!replyText) {
      console.error(
        "WARN: replyText empty. finishReason:",
        data.candidates?.[0]?.finishReason,
      );
      console.error(
        "RAW first 500 chars:",
        JSON.stringify(data).slice(0, 500),
      );
      replyText =
        "（Gemini からテキストが返ってきませんでした。時間をおいてもう一度お試しください。）";
    }
    // ---- ここまで ----

    console.error("TIME total:", afterJson - startTime, "ms");
    console.error("TIME fetch:", afterFetch - beforeFetch, "ms");
    console.error("TIME JSON.parse:", afterJson - afterFetch, "ms");

    return res.status(200).json({ text: replyText });
  } catch (err) {
    console.error("Handler error:", err);
    console.error("TIME total (catch):", Date.now() - startTime, "ms");
    return res.status(500).json({ text: "Internal server error" });
  }
}
