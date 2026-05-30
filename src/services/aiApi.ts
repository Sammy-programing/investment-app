// src/services/aiApi.ts
import { ChatMessage, Holding } from "@/types";

export async function streamAIAdvice(
  messages: ChatMessage[],
  holdings: Holding[]
): Promise<ReadableStreamDefaultReader<Uint8Array>> {
  const res = await fetch("/api/ai-advice", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, holdings }),
  });
  if (!res.ok) throw new Error(`AI API error: ${res.status}`);
  const reader = res.body?.getReader();
  if (!reader) throw new Error("ストリームが取得できませんでした");
  return reader;
}
