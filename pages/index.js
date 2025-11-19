import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";

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

  // ★ 自動スクロール用の ref
  const messagesEndRef = useRef(null);

  // ★ messages が変わるたびに最下部へスクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userText = input.trim();
    const userMessage = { role: "user", text: userText };

    // 画面に先に表示
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);
    setError("");

    // トークン節約：直近6件だけ API に送る
    const messagesForApi = updatedMessages.slice(-6);

    try {
      const resp = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: messagesForApi }),
      });

      if (!resp.ok) {
        throw new Error(`API error: ${resp.status}`);
      }

      const data = await resp.json();
      const replyText = data.text?.trim() || "（応答がありません）";

      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: replyText },
      ]);
    } catch (err) {
      console.error(err);
      setError(
        "エラーが発生しました。少し時間をおいて、もう一度お試しください。"
      );

      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "（応答がありません）" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f5f5f5",
        padding: "24px",
      }}
    >
      <div
        style={{
          maxWidth: "800px",
          margin: "0 auto",
          background: "#fff",
          borderRadius: "12px",
          padding: "24px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
        }}
      >
        <h1 style={{ marginBottom: "8px" }}>NOAH</h1>
        <p style={{ marginBottom: "16px", color: "#555", fontSize: "14px" }}>
          あなたの「考えごと」をゆっくり整理するためのチャットです。
        </p>

        {/* メッセージ一覧 */}
        <div
          style={{
            border: "1px solid #eee",
            borderRadius: "8px",
            padding: "16px",
            maxHeight: "400px",
            overflowY: "auto",
            marginBottom: "16px",
            background: "#fafafa",
          }}
        >
          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                marginBottom: "12px",
                textAlign: m.role === "user" ? "right" : "left",
              }}
            >
              <div
                style={{
                  display: "inline-block",
                  padding: "8px 12px",
                  borderRadius: "12px",
                  background: m.role === "user" ? "#d0ebff" : "#fff",
                  border: "1px solid "#ddd",
                  maxWidth: "80%",
                  whiteSpace: "pre-wrap",
                  textAlign: "left",
                }}
              >
                {/* ★ Markdown対応：太文字・見出し・箇条書きOK */}
                <ReactMarkdown>{m.text}</ReactMarkdown>
              </div>
            </div>
          ))}

          {loading && <div>NOAH が考えています…</div>}

          {/* ★ 自動スクロールの着地点 */}
          <div ref={messagesEndRef} />
        </div>

        {error && (
          <p style={{ color: "red", marginBottom: "8px" }}>{error}</p>
        )}

        {/* 入力フォーム */}
        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", gap: "8px", marginTop: "8px" }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="メッセージを入力"
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: "8px",
              border: "1px solid "#ccc",
            }}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            style={{
              padding: "0 16px",
              borderRadius: "8px",
              border: "none",
              background: loading || !input.trim() ? "#ccc" : "#0070f3",
              color: "#fff",
              cursor: loading || !input.trim() ? "default" : "pointer",
            }}
          >
            送信
          </button>
        </form>
      </div>
    </div>
  );
}
