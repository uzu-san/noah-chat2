// pages/api/noah.js

export default async function handler(req, res) {
  const startTime = Date.now();

  if (req.method !== "POST") {
    return res.status(405).json({ text: "Method not allowed" });
  }

  // body が string の場合も対応（gemini.js と同じ）
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch (e) {
      console.error("Invalid JSON body:", e);
      return res.status(400).json({ text: "Invalid JSON body" });
    }
  }

  // フロントから受け取る想定：
  // { lastNoahQuestion: "...", lastUserMessage: "..." }
  const lastNoahQuestion = typeof body?.lastNoahQuestion === "string" ? body.lastNoahQuestion : "";
  const lastUserMessage = typeof body?.lastUserMessage === "string" ? body.lastUserMessage : "";

  if (!lastUserMessage.trim()) {
    return res.status(400).json({ text: "No user message provided" });
  }

  // API キー
  const apiKey = process.env.CLIENT_KEY;
  if (!apiKey) {
    console.error("CLIENT_KEY is missing");
    return res.status(500).json({ text: "Missing API key (CLIENT_KEY)" });
  }

  // モデル（いまの gemini.js に合わせる）
  const MODEL_ID = "gemini-2.0-flash";

  const endpoint =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    MODEL_ID +
    ":generateContent";

  // ---- NOAH：超短文・1問だけ生成させる system ----
  const systemPrompt = `
あなたは「NOAH」。
返答は「問い」1つだけ。

【絶対ルール】
- 出力は1行のみ
- 必ず「？」で終える
- 10〜80文字程度（短く）
- 説明、要約、整理、共感、安心させる言葉は禁止
- 行動提案、助言、励ましは禁止
- 感情を掘る質問（どう感じた/つらい等）禁止
- 原因追及（なぜ/きっかけ/過去等）禁止
- 身体感覚誘導（体のどこ/呼吸/力を抜く等）禁止

【目的】
ユーザー発言に含まれる「当然の前提」を、そのまま露出させる問いに変換する。
`.trim();

  // Geminiに渡す最小コンテキスト（2ターン分だけ）
  const contextText = `
直前のNOAHの問い: ${sanitize(lastNoahQuestion)}
直前のユーザー発話: ${sanitize(lastUserMessage)}
`.trim();

  const payloadBase = {
    contents: [
      // system 相当
      { role: "user", parts: [{ text: systemPrompt }] },
      // 最小コンテキスト
      { role: "user", parts: [{ text: contextText }] },
    ],
  };

  const maxRetries = 3;

  try {
    const beforeFetch = Date.now();

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify(payloadBase),
      });

      const afterFetch = Date.now();

      const data = await response.json().catch((e) => {
        console.error("JSON parse error:", e);
        throw new Error("Invalid JSON from Gemini");
      });

      const afterJson = Date.now();

      // 503（過負荷）
      if (response.status === 503) {
        console.error("Gemini API overloaded (503).");
        return res.status(503).json({
          text: "現在AIサーバーが混雑しています。\n少し時間をおいて、もう一度お試しください。",
          status: 503,
        });
      }

      // その他エラー
      if (!response.ok) {
        console.error("Gemini API error:", response.status, JSON.stringify(data));
        return res.status(500).json({
          text: "Gemini API error",
          status: response.status,
          detail: data,
        });
      }

      // 返信テキスト抽出（gemini.js と同じやり方）
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

      replyText = normalize(replyText);

      // 規格チェック（破ったら再生成）
      const verdict = validateNoahQuestion(replyText);
      console.error("NOAH validate:", verdict, "text:", replyText);

      // 時間ログ
      console.error("TIME total:", afterJson - startTime, "ms");
      console.error("TIME fetch:", afterFetch - beforeFetch, "ms");

      if (verdict.ok) {
        return res.status(200).json({ text: replyText });
      }
    }

    // 最後の砦（絶対に思想を壊さない固定の問い）
    return res.status(200).json({
      text: "いま起きている事実と、苦しさは同じ瞬間ですか？",
    });
  } catch (err) {
    console.error("Handler error:", err);
    return res.status(500).json({ text: "Internal server error" });
  }
}

function sanitize(s) {
  return String(s || "").replace(/\s+/g, " ").trim().slice(0, 500);
}

function normalize(s) {
  return String(s || "")
    .replace(/\r/g, "")
    .replace(/\n+/g, " ") // 1行に潰す
    .trim()
    .replace(/^["「]|["」]$/g, "")
    .slice(0, 120);
}

function validateNoahQuestion(text) {
  if (!text) return { ok: false, reason: "empty" };
  if (text.includes("\n")) return { ok: false
