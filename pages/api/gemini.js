export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ text: "Method not allowed" });
  }

  // body が文字列で来る場合にも対応
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch (e) {
      return res.status(400).json({ text: "Invalid JSON body" });
    }
  }

  const message = body?.message?.trim();
  if (!message) {
    return res.status(400).json({ text: "No message provided" });
  }

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.error("Missing GOOGLE_API_KEY");
    return res
      .status(500)
      .json({ text: "Server API key is not configured." });
  }

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" +
        apiKey,
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

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", response.status, errorText);
      return res
        .status(500)
        .json({ text: "AI サーバーとの通信に失敗しました。" });
    }

    const data = await response.json();
    const text =
      data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
      "（応答がありません）";

    return res.status(200).json({ text });
  } catch (error) {
    console.error("Handler error:", error);
    return res
      .status(500)
      .json({ text: "サーバーでエラーが発生しました。" });
  }
}
