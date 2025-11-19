// pages/api/gemini.js

export default async function handler(req, res) {
  // ★ ① handler が呼ばれた瞬間の時刻を記録
  const startTime = Date.now(); // ←追加

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

  // ★ Vercel の環境変数から API キー取得（CLIENT_KEY に入れてある前提）
  const apiKey = process.env.CLIENT_KEY;
  if (!apiKey) {
    console.error("CLIENT_KEY is missing");
    return res.status(500).json({ text: "Missing API key (CLIENT_KEY)" });
  }

  // ★ あなたが使いたいモデル（ListModels の name をそのまま）
  const MODEL_NAME = "models/gemini-2.5-flash";

  // ★ 実際に叩く URL をログに出す
  const url =
    "https://generativelanguage.googleapis.com/v1beta/" +
    MODEL_NAME +
    ":generateContent?key=" +
    apiKey;

  console.error("DEBUG MODEL_NAME:", MODEL_NAME);
  console.error("DEBUG URL:", url);

  const payload = {
    contents: [
      {
        role: "user",
        parts: [{ text: userMessage }],
      },
    ],
    // オプションですが、ついでに制限かけておくと速くなりやすい
    generationConfig: {
      maxOutputTokens: 256,
      temperature: 0.7,
    },
  };

  try {
    // ★ ② fetch の前後で時間を取る
    const beforeFetch = Date.now(); // ←追加

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const afterFetch = Date.now(); // ←追加

    const raw = await response.text();

    const afterText = Date.now(); // ←追加（text() が終わったタイミング）

    if (!response.ok) {
      console.error("Gemini API error:", response.status, raw);

      // ★ ③ エラー時でも時間を出しておくと原因が追いやすい
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

      // ★ ④ JSON 変換に時間がかかってないかもチェック
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

    const afterJson = Date.now(); // ←追加（JSON.parse が終わったタイミング）

    let replyText = "";

try {
  const parts = data.candidates?.[0]?.content?.parts;
  if (parts && Array.isArray(parts)) {
    replyText = parts.map(p => p.text || "").join("");
  }
} catch (e) {
  console.error("PARSE ERROR:", e);
}

if (!replyText) {
  replyText = "（応答がありません）";
}


    // ★ ⑤ 最後にまとめて時間ログを出す
    const totalTime = afterJson - startTime;
    const fetchTime = afterFetch - beforeFetch;
    const textTime = afterText - afterFetch;
    const jsonTime = afterJson - afterText;

    console.error("TIME total:", totalTime, "ms"); // handler 全体
    console.error("TIME fetch:", fetchTime, "ms"); // Gemini から返るまで
    console.error("TIME text():", textTime, "ms"); // response.text() にかかった時間
    console.error("TIME JSON.parse:", jsonTime, "ms"); // JSON.parse にかかった時間

    return res.status(200).json({ text: replyText });
  } catch (error) {
    console.error("Handler error:", error);

    // ★ ⑥ 例外で落ちた場合も total だけは出しておく
    const totalTimeCatch = Date.now() - startTime;
    console.error("TIME total (catch):", totalTimeCatch, "ms");

    return res.status(500).json({ text: "Internal server error" });
  }
}
