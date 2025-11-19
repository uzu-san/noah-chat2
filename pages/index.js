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

  // 自動スクロール用
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userText = input.trim();
    const userMessage = { role: "user", text: userText };

    // 画面に先に追加
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);
    setError("");

    // API には直近 6 件だけ送る（トークン節約）
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
        background: "#f3f4f6",
        padding: "24px 12px",
      }}
    >
      <div
        style={{
          maxWidth: "860px",
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
                  {/* ラベル（誰の発言か） */}
                  <span
                    style={{
                      fontSize: "11px",
                      color: "#9ca3af",
                      marginBottom: "2px",
                    }}
                  >
                    {isUser ? "あなた" : "NOAH"}
                  </span>

                  {/* 吹き出し本体 */}
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
                    <ReactMarkdown
                      components={{
                        p: ({ node, ...props }) => (
                          <p
                            style={{
                              margin: "4px 0",
                            }}
                            {...props}
                          />
                        ),
                        ul: ({ node, ...props }) => (
                          <ul
                            style={{
                              margin: "4px 0",
                              paddingLeft: "1.2em",
                            }}
                            {...props}
                          />
                        ),
                        ol: ({ node, ...props }) => (
                          <ol
                            style={{
                              margin: "4px 0",
                              paddingLeft: "1.4em",
                            }}
                            {...props}
                          />
                        ),
                        li: ({ node, ...props }) => (
                          <li
                            style={{
                              margin: "2px 0",
                            }}
                            {...props}
                          />
                        ),
                        strong: ({ node, ...props }) => (
                          <strong
                            style={{
                              fontWeight: 700,
                            }}
                            {...props}
                          />
                        ),
                      }}
                    >
                      {m.text}
                    </ReactMarkdown>
                  </div>
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
          <p style={{ color: "#dc2626", marginBottom: "8px", fontSize: "13px" }}>
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
          }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="今の気持ちや状況を、ひとことで書いてみてください"
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: "10px",
              border: "1px solid #d1d5db",
              fontSize: "14px",
              outline: "none",
            }}
          />
          <button
            type="submit"
            disabled(loading || !input.trim())
            style={{
              padding: "0 18px",
              borderRadius: "10px",
              border: "none",
              background:
                loading || !input.trim() ? "#9ca3af" : "#2563eb",
              color: "#ffffff",
              fontSize: "14px",
              fontWeight: 600,
              cursor:
                loading || !input.trim() ? "default" : "pointer",
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
