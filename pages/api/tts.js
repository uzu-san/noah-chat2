// pages/api/tts.js

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { text } = req.body || {};
  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "No text provided" });
  }

  const apiKey = process.env.GOOGLE_TTS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Missing GOOGLE_TTS_API_KEY" });
  }

  try {
    const ttsResp = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: { text },
          voice: {
            languageCode: "ja-JP",
            // 自然さと速度バランスの良いニューラルボイス
            name: "ja-JP-Neural2-B",
          },
          audioConfig: {
            audioEncoding: "MP3",
            speakingRate: 1.05, // 少しだけ速め（体感スッキリ）
          },
        }),
      }
    );

    if (!ttsResp.ok) {
      const errText = await ttsResp.text();
      console.error("TTS error:", errText);
      return res.status(500).json({ error: "TTS API error" });
    }

    const data = await ttsResp.json();
    const audioContent = data.audioContent;

    if (!audioContent) {
      return res.status(500).json({ error: "No audio content" });
    }

    const audioBuffer = Buffer.from(audioContent, "base64");

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    res.status(200).send(audioBuffer);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
}
