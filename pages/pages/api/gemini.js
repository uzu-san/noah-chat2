// pages/api/gemini.js

export default async function handler(req, res) {
  // POST 以外は拒否
  if (req.method !== "POST") {
    return res.status(405).json({ text: "Method not allowed" });
  }

  // body が文字列で届くこともあるので両対応
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch (e) {
      return res.status(400).json({ text: "Invalid JSON body" });
    }
  }

  const message = body?.message;
  if (!message) {
    return res.status(400).json({ text: "No message provided" });
  }

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    // Vercel の環境変数設定ミス時にここに来ます
    return res.status(500).json({ text: "Missing GOOGLE_API_KEY" });
  }

  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: message }],
            },
          ],
        }),
      }
    );

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      console.error("Gemini API error", resp.status, errText);
      return res.status(500).json({ text: "Gemini API error" });
    }

    const data = await resp.json();
    const replyText =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "（応答なし）";

    return res.status(200).json({ text: replyText });
  } catch (e) {
    console.error("Handler error", e);
    return res.status(500).json({ text: "Internal server error" });
  }
}
