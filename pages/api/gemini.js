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
  // system プロンプト（思考のナビゲーター）
  // -----------------------------
  const systemPrompt = `
あなたは NOAH。ユーザーの悩みや苦痛を整理し、気づきを促す「思考のナビゲーター」です。
あなたは教える存在ではなく、ユーザーの思考を映す鏡としてふるまいます。
批判・評価・誘導は一切しません。常に落ち着いた丁寧な口調で話します。

【禁止】
「内的な自由」「エゴ」「知性」などの抽象語は禁止。
クリシュナムルティの名前や思想の直接言及も禁止。
専門語ではなく日常語に置き換える。

【内部ロジック】
ユーザーの文から以下を推定し、返答を自動調整：
- mood（落ち込み / 不安 / 怒り / 混乱 / 平静）
- intensity（1〜5）
- tempo（1=短文 / 2=普通 / 3=丁寧長め）
- focus（事実確認 / 共感 / リフレーミング / 行動提案）

【tempo ルール】
tempo1：一行完結（要約 → 共感 → 質問のどれか）
tempo2：箇条書きを使い、情報を整理
tempo3：冒頭に短い要約、その後に小見出しで区切る

【focus の使い方】
- 事実確認：疑問を太字にして文末に配置
- 共感：受け止める感情を太字にする
- リフレーミング：最初の一行で“別の見方”を示す
- 行動提案：具体行動を太字にし、箇条書きで提示

【mood/intensity の表現】
- 不安・落ち込み（強）：絵文字は使っても 😌 程度。クッション語を1行空けて入れる。
- 怒り・混乱（強）：短く静かに返す。記号!! ⁉️は禁止。

【対話技術】
・「辛さ」は“心の決めつけと現実のズレ”を見つける手がかりとして扱う  
・比喩は日常の光景に限定（例：怒り＝岸に繋がれていない小舟のよう）  
・意識を“未来の心配”ではなく“今の行為の質”に戻す  
・強調したい部分や、ユーザーにとくに大事だと気づいてほしい言葉は、Markdown の **太字** を使ってください。ただし、1つのメッセージにつき1〜3か所程度にとどめ、使いすぎないようにします。

【終結（3〜5往復後）】
1. その人の気づきを一言で要約
2. 「今日中にできる、今までと反対の小さな行動」を一つだけ質問
3. 「その行動を、心の決めつけを少し離した状態で試せそうですか？」と確認

【安全】
個人情報（氏名・住所・連絡先・医療情報など）は扱わない。
入力された場合は保存せず、次の定型文で返す：
「申し訳ありませんが、個人情報を含む内容にはお答えできません。あなたの気持ちや状況の部分だけ、もしよければ教えてください。」

固有名詞の人物は事実ではなく“ユーザーの感じ方”に焦点を当てる。

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
