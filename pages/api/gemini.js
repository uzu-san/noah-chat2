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

  // 使うモデル
  const MODEL_NAME = "models/gemini-2.5-flash";

  // 実際に叩く URL（※ログでは key を出さない）
  const url =
    "https://generativelanguage.googleapis.com/v1beta/" +
    MODEL_NAME +
    ":generateContent?key=" +
    apiKey;

  console.error("DEBUG MODEL_NAME:", MODEL_NAME);
  console.error("DEBUG PATH:", "/v1beta/" + MODEL_NAME + ":generateContent");

  const payload = {
    contents: [
      {
        role: "user",
        parts: [{ text: userMessage }],
      },
    ],
    generationConfig: {
      maxOutputTokens: 128, // ここはお好みで
      temperature: 0.7,
    },
  };

  try {
    const beforeFetch = Date.now();

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const afterFetch = Date.now();
    const raw = await response.text();
    const afterText = Date.now();

    if (!response.ok) {
      console.error("Gemini API error:", response.status, raw);

      const totalTimeError = Date.now() - startTime;
      const fetchTimeError = afterFetch - beforeFetch;
      const textTimeError = afterText - afterFetch;

      console.error("TIME total (error):", totalTimeError, "ms");
      console.error("TIME fetch (error):", fetchTimeError, "ms");
      console.error("TIME text() (error):", textTimeError, "ms");

      return res.status(500).json({
        text: "Gemini API error",
        status: response.status,
        detail: raw,
      });
    }

    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      console.error("JSON parse error:", e);

      const totalTimeError = Date.now() - startTime;
      const fetchTimeError = afterFetch - beforeFetch;
      const textTimeError = afterText - afterFetch;

      console.error("TIME total (json error):", totalTimeError, "ms");
      console.error("TIME fetch (json error):", fetchTimeError, "ms");
      console.error("TIME text() (json error):", textTimeError, "ms");

      return res.status(500).json({
        text: "Invalid JSON from Gemini",
        detail: raw,
      });
    }

    const afterJson = Date.now();

    // ---------- ここが今回の「本命修正」部分 ----------
    // できるだけ多くのパターンに対応して text を抜き出す
    let replyText = "";

    try {
      // 1. SDK と同じように data.text があればそれを優先
      if (typeof data.text === "string" && data.text.trim()) {
        replyText = data.text;
      } else if (Array.isArray(data.candidates) && data.candidates.length > 0) {
        const c0 = data.candidates[0];

        // content が配列の場合とオブジェクトの場合どちらも対応
        const contentsArray = Array.isArray(c0.content)
          ? c0.content
          : c0.content
          ? [c0.content]
          : [];

        const partsTexts = [];

        for (const content of contentsArray) {
          const parts = content?.parts;
          if (!Array.isArray(parts)) continue;

          for (const p of parts) {
            // thinking 付きモデルだと、parts の中に text 以外も混ざる
            if (typeof p.text === "string") {
              partsTexts.push(p.text);
            }
            // もし output_text 形式で返る場合（将来用の保険）
            if (p.output_text && typeof p.output_text.text === "string") {
              partsTexts.push(p.output_text.text);
            }
          }
        }

        replyText = partsTexts.join("").trim();
      }
    } catch (e) {
      console.error("PARSE replyText ERROR:", e);
    }

    // うまく取れなかった場合は raw を少しだけ表示して調査用に残す
    if (!replyText) {
      console.error("WARN: replyText is empty. RAW (first 500 chars):");
      console.error(raw.slice(0, 500));
      replyText = "（応答がありません）";
    }
    // ---------- 修正ここまで ----------

    const totalTime = afterJson - startTime;
    const fetchTime = afterFetch - beforeFetch;
    const textTime = afterText - afterFetch;
    const jsonTime = afterJson - afterText;

    console.error("TIME total:", totalTime, "ms");
    console.error("TIME fetch:", fetchTime, "ms");
    console.error("TIME text():", textTime, "ms");
    console.error("TIME JSON.parse:", jsonTime, "ms");

    return res.status(200).json({ text: replyText });
  } catch (error) {
    console.error("Handler error:", error);

    const totalTimeCatch = Date.now() - startTime;
    console.error("TIME total (catch):", totalTimeCatch, "ms");

    return res.status(500).json({ text: "Internal server error" });
  }
}
