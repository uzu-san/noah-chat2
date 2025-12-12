import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";

/* ----------------------------------------
   NOAH システムプロンプト（Gemini に渡す軸）
---------------------------------------- */

const NOAH_SYSTEM_PROMPT = `
あなたは「NOAH」という名前の対話AIです。
ユーザーの悩みや混乱を、思考の「内容」ではなく、
思考が生まれる「反応の構造」から整理することを役割とします。

【基本スタンス】
- 判断しない・指示しない・励ましすぎない・誘導しない。
- 心理学用語・宗教用語・スピリチュアルな表現は使わない。
- 難しい専門用語は避け、日常の例えで説明する。
- ユーザーを「前向きにさせる」ことではなく、
  「頭のノイズが減って状況が整理されること」を優先する。

【Mode1：状況の仕分け】
目的：できごと（事実）と、心の反応（感情・考え）を分ける。
- 例：「雨が降っている」はできごと、「最悪だ…」は反応。
- 使う質問例：
  - 「まず、“起きたできごと” を簡単に教えてもらえますか？」
  - 「そのとき、起きたできごとと、そのときの反応を分けるとどうなりそうですか？」

話が広がったり、自己分析に寄りすぎたら、
「いまのは心の反応のほうかもしれません。
  その前に起きた“できごと”はどんなことでしたか？」
のように優しく軌道修正してください。

【Mode2：反応の内側を見る】
目的：反応がどんな仕組みで立ち上がっているかを見える化する。
- 原因探しや過去ほじくりはしない。「なぜ？」は極力使わない。
- 使う質問例：
  - 「そのできごとを見た瞬間、まず何が動きましたか？」
  - 「その反応は、どこから立ち上がってくる感じですか？」
  - 「その反応が強くなると、判断や行動にどんな影響がありますか？」

ユーザーが自己否定や分析に入りすぎたら、
「すこし分析寄りになりましたね。
  その手前で起きていた“反応そのもの”に戻ってみましょう。」
などと返し、やさしく“いま起きている反応”に戻してください。

【まとめ】
- 対話の終わりには、その回で見えたことを一行で整理して返す。
  例：「今日は“できごと”よりも、その瞬間の反応のほうが負荷になっていた部分が見えてきましたね。」
- 行動指示はしない。
  「今日の判断や行動が、少しでも楽になりそうなポイントはありますか？」
  程度の問いかけにとどめる。

【禁止・注意】
- 「静けさ」「悟り」「宇宙」「波動」「エネルギー」「エゴ」「魂」などの宗教的・スピリチュアルな語は使わない。
- 代わりに、「頭のノイズが減る」「モヤモヤが整理される」「状況が見えやすくなる」など、現実的な表現を使う。
- 個人情報（氏名・住所・連絡先・職場・病歴など）には触れない。
`;

/* ----------------------------------------
   ビジネス向け語彙セット＆置き換えフィルタ
---------------------------------------- */

const noahVocabulary = {
  replacements: [
    {
      avoid: ["静かになる", "心が静まる", "静けさ"],
      use: ["頭のノイズが減る", "気持ちのざわつきが少しおさまる"],
    },
    {
      avoid: ["悟り", "悟る", "目覚める"],
      use: ["腑に落ちる", "はっきり見えてくる"],
    },
    {
      avoid: ["宇宙", "宇宙の流れ"],
      use: ["周りの状況", "今の環境"],
    },
    {
      avoid: ["波動", "エネルギーが上がる", "エネルギー"],
      use: ["雰囲気が変わる", "空気感が変わる"],
    },
    {
      avoid: ["エゴ"],
      use: ["自分の中の決めつけ", "頭の中のストーリー"],
    },
    {
      avoid: ["内的な自由"],
      use: ["余計な縛りが少ない状態", "必要以上に自分をしばっていない状態"],
    },
    {
      avoid: ["執着を手放す", "執着"],
      use: ["こだわりが少しゆるむ", "そこに考えを貼りつけ過ぎない"],
    },
    {
      avoid: ["癒やされる", "癒される"],
      use: ["気持ちの負担が少し軽くなる"],
    },
    {
      avoid: ["魂", "真我", "本質"],
      use: ["自分の本音", "心の奥で本当に感じていること"],
    },
    {
      avoid: ["心が落ち着く"],
      use: ["判断しやすい状態になる", "冷静さを取り戻しやすくなる"],
    },
    {
      avoid: ["心が軽くなる"],
      use: ["考えすぎで重くなっていた部分が少し弱まる"],
    },
    {
      avoid: ["心がクリアになる"],
      use: ["状況が整理されて見えやすくなる"],
    },
  ],
};

function sanitizeAssistantText(text) {
  if (!text) return text;
  let result = text;
  for (const group of noahVocabulary.replacements) {
    const replaceTo =
      group.use[Math.floor(Math.random() * group.use.length)];
    for (const ng of group.avoid) {
      if (result.includes(ng)) {
        result = result.split(ng).join(replaceTo);
      }
    }
  }
  return result;
}

/* ----------------------------------------
   堂々巡り判定（シンプル版：同じ話の繰り返し検出）
---------------------------------------- */

function detectLoop(userMessages) {
  if (userMessages.length < 4) return false;

  const recent = userMessages.slice(-4);
  const joined = recent.join(" ");

  const metaWords = ["また同じ", "進まない", "ぐるぐる", "どうしたらいい", "わからない"];
  const metaHit = metaWords.some((w) => joined.includes(w));

  const similarity = (s1, s2) => {
    const a = s1.trim();
    const b = s2.trim();
    const minLen = Math.min(a.length, b.length);
    if (minLen === 0) return 0;
    let same = 0;
    for (let i = 0; i < minLen; i++) {
      if (a[i] === b[i]) same++;
    }
    return same / minLen;
  };

  const s1 = similarity(recent[2], recent[3]);
  const s2 = similarity(recent[1], recent[2]);

  return metaHit || s1 > 0.75 || s2 > 0.75;
}

/* ----------------------------------------
   Google TTS 高速＋自然音声版 speak()
---------------------------------------- */

let currentAudio = null;
const audioCache = new Map();
const MAX_TTS_LENGTH = 400;

async function speak(originalText) {
  if (!originalText) return;

  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }

  let text = originalText.trim();
  if (text.length > MAX_TTS_LENGTH) {
    text = text.slice(0, MAX_TTS_LENGTH) + "。以下は読み上げを省略します。";
  }

  if (audioCache.has(text)) {
    const cachedUrl = audioCache.get(text);
    const audio = new Audio(cachedUrl);
    currentAudio = audio;
    audio.play();
    audio.onended = () => {
      if (currentAudio === audio) currentAudio = null;
    };
    return;
  }

  try {
    const resp = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!resp.ok) {
      console.error("TTS API error:", await resp.text());
      return;
    }

    const arrayBuffer = await resp.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: "audio/mpeg" });
    const url = URL.createObjectURL(blob);

    audioCache.set(text, url);

    const audio = new Audio(url);
    currentAudio = audio;
    audio.play();
    audio.onended = () => {
      if (currentAudio === audio) currentAudio = null;
    };
  } catch (e) {
    console.error("TTS client error:", e);
  }
}

/* ----------------------------------------
   NOAH 本体（UI＋送信ロジック＋反応カウンター）
---------------------------------------- */

export default function Home() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "こんにちは。ここは、あなたが安心して考えを置ける場所です。今日は、どんな気持ちから始めましょうか？",
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reactionDepth, setReactionDepth] = useState(0); // 反応カウンター

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [input]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userText = input.trim();
    const userMessage = { role: "user", text: userText };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);
    setError("");

    // 1) ユーザーの感情語を検出して反応カウンターを更新
    const emotionWords = ["焦り", "不安", "嫌", "つら", "辛", "苦", "怖", "やば"];
    let newDepth = reactionDepth;
    if (emotionWords.some((w) => userText.includes(w))) {
      newDepth = reactionDepth + 1;
    }

    // 2) 一定回数を超えたら「まとめフェーズ」へ（API 呼び出しをスキップ）
    if (newDepth >= 3) {
      const summary =
        "ここまでのお話を整理すると、\n" +
        "「実際に起きていること」そのものよりも、\n" +
        "その場面で立ち上がる“焦りや不安の反応”のほうが、\n" +
        "集中力や判断を揺らしていたように見えます。\n\n" +
        "このことに気づいた今、\n" +
        "今日の行動や取り組みが、少しでもラクになりそうなポイントはありますか？";

      setReactionDepth(0); // リセット
      setMessages((prev) => [...prev, { role: "assistant", text: summary }]);
      setLoading(false);
      return;
    } else {
      setReactionDepth(newDepth);
    }

    // 3) ユーザー発話だけ抜き出して堂々巡りチェック
    const userMessagesOnly = updatedMessages
      .filter((m) => m.role === "user")
      .map((m) => m.text);

    const isLoop = detectLoop(userMessagesOnly);

    if (isLoop) {
      const loopReply =
        "少し同じところをぐるぐる回っている感じもありますね。\n" +
        "いちど整理のために、実際に起きたできごとと、\n" +
        "それを見たときに立ち上がった反応を、もう一度だけ分けてみてもよいでしょうか？";

      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: loopReply },
      ]);
      setLoading(false);
      return;
    }

    // 4) 直近のメッセージ（会話履歴）をAPIに送る
    // 4) NOAH専用：直近2ターンだけを /api/noah に送る

// 直前のNOAHの問い（なければ空）
    // 4) NOAH専用：直近2ターンだけを /api/noah に送る

    // 直前のNOAHの問い（なければ空）
    const lastNoahQuestion =
      [...updatedMessages]            
        .reverse()
        .find((m) => m.role === "assistant")?.text || "";

    const apiPayload = {
      lastNoahQuestion,
      lastUserMessage: userText,
    };

    try {
      const resp = await fetch("/api/noah", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(apiPayload),
      });

      if (!resp.ok) throw new Error(`API error: ${resp.status}`);

      const data = await resp.json();
      const replyText = data.text?.trim() || "（応答がありません）";

      // 表示は2ターン固定（NOAHの問い + ユーザー発話）
      setMessages([
        { role: "assistant", text: replyText },
        { role: "user", text: userText },
      ]);
    } catch (err) {
      console.error(err);
      setError("エラーが発生しました。少し時間をおいて、もう一度お試しください。");

      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "（応答がありません）" },
      ]);
    } finally {
      setLoading(false);
    }


  const handleSubmit = async (e) => {
    e.preventDefault();
    await sendMessage();
  };

  const handleKeyDown = async (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      await sendMessage();
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f3f4f6",
        padding: "16px 8px",
      }}
    >
      <div
        style={{
          maxWidth: "720px",
          margin: "0 auto",
          background: "#ffffff",
          borderRadius: "16px",
          padding: "24px 20px 20px",
          boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
          border: "1px solid #e5e7eb",
        }}
      >
        {/* ヘッダー */}
        <header
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            marginBottom: "12px",
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: "22px",
                fontWeight: 700,
                letterSpacing: "0.04em",
              }}
            >
              NOAH
            </h1>
            <p
              style={{
                margin: "4px 0 0",
                color: "#6b7280",
                fontSize: "13px",
              }}
            >
              あなたの「考えごと」を整理する、思考ナビゲーター。
            </p>
          </div>
        </header>

        {/* メッセージ一覧 */}
        <div
          style={{
            borderRadius: "12px",
            border: "1px solid #e5e7eb",
            padding: "16px",
            maxHeight: "480px",
            overflowY: "auto",
            marginTop: "12px",
            marginBottom: "12px",
            background: "#f9fafb",
          }}
        >
          {messages.map((m, i) => {
            const isUser = m.role === "user";
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: isUser ? "flex-end" : "flex-start",
                  marginBottom: "10px",
                }}
              >
                <div
                  style={{
                    maxWidth: "80%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: isUser ? "flex-end" : "flex-start",
                  }}
                >
                  <span
                    style={{
                      fontSize: "11px",
                      color: "#9ca3af",
                      marginBottom: "2px",
                    }}
                  >
                    {isUser ? "あなた" : "NOAH"}
                  </span>

                  <div
                    style={{
                      display: "inline-block",
                      padding: "10px 12px",
                      borderRadius: "14px",
                      background: isUser ? "#dbeafe" : "#ffffff",
                      border: isUser
                        ? "1px solid #bfdbfe"
                        : "1px solid #e5e7eb",
                      boxShadow: isUser
                        ? "0 1px 4px rgba(59,130,246,0.15)"
                        : "0 1px 4px rgba(15,23,42,0.08)",
                      textAlign: "left",
                      lineHeight: 1.6,
                      fontSize: "14px",
                      color: "#111827",
                      wordBreak: "break-word",
                    }}
                  >
                    <ReactMarkdown>{m.text}</ReactMarkdown>
                  </div>

                  <button
                    type="button"
                    onClick={() => speak(m.text)}
                    style={{
                      marginTop: "4px",
                      fontSize: "11px",
                      color: "#6b7280",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      textDecoration: "underline",
                      alignSelf: isUser ? "flex-end" : "flex-start",
                    }}
                  >
                    🔊 このメッセージを聞く
                  </button>
                </div>
              </div>
            );
          })}

          {loading && (
            <div
              style={{
                fontSize: "13px",
                color: "#6b7280",
                marginTop: "4px",
              }}
            >
              NOAH が考えを整理しています…
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {error && (
          <p
            style={{
              color: "#dc2626",
              marginBottom: "8px",
              fontSize: "13px",
            }}
          >
            {error}
          </p>
        )}

        {/* 入力フォーム */}
        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            gap: "8px",
            marginTop: "8px",
            alignItems: "flex-end",
          }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder=""
            rows={2}
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: "10px",
              border: "1px solid #d1d5db",
              fontSize: "14px",
              outline: "none",
              resize: "none",
              lineHeight: "1.5",
              minHeight: "44px",
              maxHeight: "140px",
              overflowY: "auto",
            }}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            style={{
              padding: "8px 18px",
              borderRadius: "10px",
              border: "none",
              background: loading || !input.trim() ? "#9ca3af" : "#2563eb",
              color: "#ffffff",
              fontSize: "14px",
              fontWeight: 600,
              cursor: loading || !input.trim() ? "default" : "pointer",
              whiteSpace: "nowrap",
            }}
          >
            送信
          </button>
        </form>
      </div>
    </div>
  );
}
