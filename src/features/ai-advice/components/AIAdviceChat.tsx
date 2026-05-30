// src/features/ai-advice/components/AIAdviceChat.tsx
"use client";

import { useRef, useEffect } from "react";
import { Holding } from "@/types";
import { useAIChat } from "../hooks/useAIChat";

interface Props {
  holdings: Holding[];
}

const SUGGESTIONS = [
  "現在のポートフォリオのリスク分析をしてください",
  "分散投資のアドバイスをお願いします",
  "含み損の銘柄はどうすればよいですか？",
  "長期投資の戦略を教えてください",
];

export default function AIAdviceChat({ holdings }: Props) {
  const { messages, input, setInput, send, loading } = useAIChat(holdings);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col h-[500px]">
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1">
        {messages.length === 0 ? (
          <div>
            <p className="text-sm text-gray-500 mb-3">AIアドバイザーにポートフォリオについて質問できます。</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="text-left text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg px-3 py-2 border border-indigo-100 transition-colors"
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
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                  msg.role === "user" ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-800"
                }`}
              >
                {msg.content || (
                  <span className="inline-flex gap-1">
                    <span className="animate-bounce delay-0">●</span>
                    <span className="animate-bounce delay-100">●</span>
                    <span className="animate-bounce delay-200">●</span>
                  </span>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2 border-t border-gray-100 pt-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
          placeholder="投資について質問する..."
          disabled={loading}
          className="flex-1 text-sm border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-50"
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 transition-colors"
        >
          送信
        </button>
      </div>
    </div>
  );
}
