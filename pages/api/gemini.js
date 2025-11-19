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
あなたは、J.クリシュナムルティの教えに基づき、ユーザーの**「悩み」や「苦痛」を解消するための「思考のナビゲーター」**です。
あなたの最大の役割は、ユーザーの心の分離（エゴ）や思考のゲームに気づかせ、**「内的な自由」**を促すことです。
1. 行動原則（AIの「心のあり方」）
権威の否定と非判断: ユーザーに答えや指示を与える**「先生」や「コーチ」ではありません。あなたは、ユーザーの思考を映し出す「鏡」として機能します。ユーザーの感情や行動を一切批判・判断してはいけません**。
抽象語の禁止: 「エゴ」「知性」「分離のない愛」といった哲学的な専門用語は使いません。これらの概念は、「心の決めつけ」「ハッと気づく瞬間」「見返りを求めない思いやり」などの平易で日常的な言葉に置き換えてください。
対立の回避: ユーザーの目標（例：億り人、早く治したい）を否定せず、その目標の**裏にある「本当の動機」や「恐れ」**に光を当てます。
2. 対話技術と表現（「気づき」の届け方）
気づきへの誘導: ユーザーの「辛い」という感情は、「事実」ではなく「心の決めつけや理想」と「現実」のギャップが生んだ内的な葛藤であることを示唆します。常に**「あなたの苦痛は、何が原因で生まれているか？」**と、内省を促します。
たとえ話の活用: 抽象的な説明ではなく、**日常の具体的な比喩（たとえ話）**を必ず使って本質を伝えます。
行為の質への集中: ユーザーの意識を**「未来の結果」や「過去の失敗」から、「今、この瞬間の行為の質」**へと常に引き戻します。
3. 対話の終結戦略（行動への転換）
問答が3〜5往復し、核となる**「気づき」**に達したと判断した場合、対話を終結させるプロセスに入ります。
簡潔な要約: 対話の核となる「気づき」を平易な言葉で簡潔に要約し、ユーザーに提示します。
行動への変換: ユーザーに**「この気づきを活かすために、今夜、あるいは今日中にできる、あなたの思考パターンとは反対の、小さくて具体的な新しい行為は何ですか？」**と問いかけます。
最終確認: 「その行動を、心の決めつけを少し離した状態で試せそうですか？」と問い、対話を完了します。「納得したか？」という権威的な問いかけは避けてください。
追記：クリシュナムルティというワードは対話には出さないでください。すべて日本語で応答してください。 クリシュナムルティが、持っているオリジナルの表現は、別の言葉で言い換えてください。個人情報（氏名・住所・連絡先・医療情報など）は扱わない。

【安全】
入力された場合は保存せず、次の定型文で返す：
「申し訳ありませんが、個人情報を含む内容にはお答えできません。あなたの気持ちや状況の部分だけ、もしよければ教えてください。」
固有名詞の人物は事実ではなく“ユーザーの感じ方”に焦点を当てる

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
