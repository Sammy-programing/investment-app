// src/components/AIFloatingButton.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { useHoldings } from "@/features/portfolio/hooks/useHoldings";
import { useAIChat } from "@/features/ai-advice/hooks/useAIChat";

const SUGGESTIONS = [
  "現在のポートフォリオのリスク分析をしてください",
  "分散投資のアドバイスをお願いします",
  "含み損の銘柄はどうすればよいですか？",
];

export default function AIFloatingButton() {
  const [open, setOpen] = useState(false);
  const { allHoldings } = useHoldings();
  const { messages, input, setInput, send, loading } = useAIChat(allHoldings);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <>
      {/* FAB ボタン */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-medium text-white shadow-lg transition-all hover:scale-105"
          style={{ background: "var(--accent)" }}
        >
          💬 AIに相談
        </button>
      )}

      {/* チャットパネル */}
      {open && (
        <div
          className="fixed bottom-6 right-6 z-50 flex flex-col rounded-2xl border shadow-2xl overflow-hidden"
          style={{
            width: "380px",
            height: "500px",
            background: "var(--bg-card)",
            borderColor: "var(--border-card)",
          }}
        >
          {/* ヘッダー */}
          <div
            className="flex items-center justify-between px-4 py-3 flex-shrink-0"
            style={{ background: "var(--bg-sidebar)", borderBottom: "1px solid var(--border-card)" }}
          >
            <span className="text-sm font-medium" style={{ color: "var(--text-main)" }}>
              💬 AIアドバイザー
            </span>
            <button
              onClick={() => setOpen(false)}
              className="text-lg leading-none hover:opacity-60 transition-opacity"
              style={{ color: "var(--text-sub)" }}
            >
              ×
            </button>
          </div>

          {/* メッセージエリア */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 ? (
              <div>
                <p className="text-xs mb-3" style={{ color: "var(--text-sub)" }}>
                  ポートフォリオについて質問できます。
                </p>
                <div className="space-y-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => setInput(s)}
                      className="block w-full text-left text-xs px-3 py-2 rounded-lg border transition-colors hover:opacity-80"
                      style={{
                        background: "rgba(99,102,241,0.1)",
                        borderColor: "rgba(99,102,241,0.2)",
                        color: "var(--text-main)",
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className="max-w-[85%] rounded-2xl px-3 py-2 text-xs whitespace-pre-wrap"
                    style={{
                      background: msg.role === "user" ? "var(--accent)" : "var(--bg-page)",
                      color: "var(--text-main)",
                    }}
                  >
                    {msg.content || (
                      <span className="inline-flex gap-1">
                        <span className="animate-bounce">●</span>
                        <span className="animate-bounce" style={{ animationDelay: "0.1s" }}>●</span>
                        <span className="animate-bounce" style={{ animationDelay: "0.2s" }}>●</span>
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          {/* 入力エリア */}
          <div
            className="flex gap-2 p-3 flex-shrink-0"
            style={{ borderTop: "1px solid var(--border-card)" }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
              placeholder="投資について質問する..."
              disabled={loading}
              className="flex-1 text-xs px-3 py-2 rounded-lg border focus:outline-none focus:ring-1"
              style={{
                background: "var(--bg-page)",
                borderColor: "var(--border-card)",
                color: "var(--text-main)",
              }}
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              className="px-4 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-40 transition-opacity"
              style={{ background: "var(--accent)" }}
            >
              送信
            </button>
          </div>
        </div>
      )}
    </>
  );
}
