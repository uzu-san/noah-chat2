   import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";

/* ----------------------------------------
   Google TTS 高速＋自然音声版 speak()
   （前の音声を止めてから再生・キャッシュ付き）
---------------------------------------- */

// 今再生中の Audio を保持
let currentAudio = null;

// TTS結果をキャッシュ（同じ文は2回目以降すぐ再生）
const audioCache = new Map();
const MAX_TTS_LENGTH = 400; // 高速化のため読み上げは400文字まで

async function speak(originalText) {
  if (!originalText) return;

  // すでに再生中なら止める
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }

  // 長文は先頭だけ読み上げ（速度優先）
  let text = originalText.trim();
  if (text.length > MAX_TTS_LENGTH) {
    text = text.slice(0, MAX_TTS_LENGTH) + "。以下は読み上げを省略します。";
  }

  // キャッシュにあれば即再生
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

    // キャッシュ保存
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
   ここから下は NOAH 本体（前とほぼ同じ）
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

    const messagesForApi = updatedMessages.slice(-6);

    try {
      const resp = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: messagesForApi }),
      });

      if (!resp.ok) throw new Error(`API error: ${resp.status}`);

      const data = await resp.json();
      const replyText = data.text?.trim() || "（応答がありません）";

      setMessages((prev) => [...prev, { role: "assistant", text: replyText }]);
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
  };

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
              あなたの「考えごと」を静かに整理する、思考ナビゲーター。
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
                  {/* ラベル */}
                  <span
                    style={{
                      fontSize: "11px",
                      color: "#9ca3af",
                      marginBottom: "2px",
                    }}
                  >
                    {isUser ? "あなた" : "NOAH"}
                  </span>

                  {/* 吹き出し */}
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

                  {/* 音声読み上げボタン */}
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
              NOAH が静かに考えています…
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
            placeholder="今の気持ちや状況を書いてみてください"
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
