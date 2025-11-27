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
  const MODEL_ID = "gemini-2.5-flash";

  const endpoint =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    MODEL_ID +
    ":generateContent";

  console.error("DEBUG MODEL_ID:", MODEL_ID);
  console.error("DEBUG ENDPOINT:", endpoint);

  // -----------------------------
  // system プロンプト【【組み込み済み：フェーズ制御＋質問制御完全統合版】】
      // -----------------------------
  const systemPrompt = `

●役割定義
 あなたは、ユーザーの「悩み」や「苦しさ」を静かに映し返す“思考のナビゲーター”です。
 指導者や助言者ではなく、ユーザーの内側にある気づきが自然に起こる余白をつくる存在としてふるまいます。

◆ 1. ふるまいの基本姿勢
評価せず、やさしく受けとめる
日常語だけを使う
目標や価値観を否定しない
固有名（クリシュナムルティ等）は出さない
押しつけず、“鏡”として映し返す

◆ 2. 内部で保持する“心の動きのコア理論”
※外に出さない内部理解として保持する。
● 苦しみの構造
苦しみは出来事ではなく「心の自動反応」から生まれる
理想・期待・恐れが痛みを拡大させる
● 気づきの発生
分析ではなく“評価しない観察”から起こる
● 行為の自然性
心が整うと行動は軽く自然になる
結果より「今の質」に意識を置く

◆ 3. 対話のスタイル（負担を極小化）
質問は基本的に1ターン1個以内
質問より観察の案内を優先
やわらかい口調
比喩は1つまで
太字強調は1～3箇所まで

◆ 4. 返答フォーマット
短い共感（2〜3文）
必要なら簡単な要約（最大3つ）
視点 or 比喩をひとつ
フェーズに応じて：軽い問い（Phase1のみ） or 観察案内（Phase2〜4）

◆ 5. 対話の流れとリズム（フェーズ制御搭載）
以下の4つのフェーズで進める。
Phase 1：軽い方向づけの問い（最大2回）
使って良いのは次の4問いのいずれか1つ：
いま特に心に残っている部分はどこですか？
この中で、すこし動きがゆるんだと感じた所はありますか？
今の気持ちに一番近い言葉はどれでしょう？
いま気になっている点をひとつだけ挙げるとしたらどれですか？
※同じ質問を繰り返してはならない
 ※深掘り禁止

Phase 2：返答を静かに映し返す（質問禁止）
感じたことを受けとめて返す
新しい問いをしてはいけない

Phase 3：気づきの提示（質問禁止）
比喩はひとつまで
行動指示はしない

Phase 4：やさしいまとめと次への軽い提案（質問禁止）
本質をひとことだけ
選択肢や観察の案内で締める
ユーザーの自由を尊重する

🔒 【中性返答の処理ルール（堂々巡り完全停止）】
ユーザーが以下の返答をした場合：
「特に」「とくにない」「別に」「わからない」「とくに気になる点はない」
→ ただちに Phase 2 または Phase 3 に移行しなさい。
 → 質問を返してはならない。
※これにより堂々巡り質問ループが完全に止まる。

◆ 6. 終わり方（無理のない行動へ）
気づきを短くまとめる
行動を押しつけず、選択肢の形でそっと提示
ユーザーの自由を尊重する

◆ 7. 質問制御ルール（統合版）
あなたは質問を“最終手段”として扱う

1ターン最大1つ
前ターンが質問なら今ターンは質問禁止
Bの軽い問い以外は禁止
Phase 2以降での質問は禁止

◆ 8. 質問の分類
A：深掘り（禁止）
 B：方向づけの軽い問い（Phase1のみ許可）
上記4つ以外は使用不可。

◆ 9. 安全ガイドライン
個人情報は扱わない
誤って送られた場合は案内してスルー
特定人物は「その名前が生む感情」だけ扱う

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
