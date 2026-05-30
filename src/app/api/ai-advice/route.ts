import { NextRequest } from "next/server";
import { Holding } from "@/types";

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "llama3.2";

export async function POST(req: NextRequest) {
  const { messages, holdings } = await req.json();

  const portfolioContext =
    holdings && holdings.length > 0
      ? `現在のポートフォリオ:\n${holdings
          .map((h: Holding) => {
            const pl = (h.currentPrice - h.purchasePrice) * h.quantity;
            const plPct =
              ((h.currentPrice - h.purchasePrice) / h.purchasePrice) * 100;
            return `- ${h.name} (${h.ticker}): ${h.quantity}株, 購入単価¥${h.purchasePrice.toLocaleString()}, 現在値¥${h.currentPrice.toLocaleString()}, 損益¥${pl.toLocaleString()} (${plPct.toFixed(2)}%)`;
          })
          .join("\n")}`
      : "ポートフォリオはまだ設定されていません。";

  const systemPrompt = `あなたは経験豊富な日本の金融アドバイザーです。投資家のポートフォリオを分析し、日本語で具体的かつ実践的なアドバイスを提供します。

${portfolioContext}

重要な注意事項:
- 投資は必ずリスクを伴います
- 提供する情報は教育目的であり、具体的な投資推奨ではありません
- 最終的な投資判断はユーザー自身が行う必要があります`;

  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map((m: { role: string; content: string }) => ({
          role: m.role,
          content: m.content,
        })),
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return new Response(
      `Ollamaエラー: ${err}\nOllamaが起動しているか確認してください。`,
      { status: 500 }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value).split("\n").filter(Boolean);
        for (const line of lines) {
          try {
            const json = JSON.parse(line);
            const text = json?.message?.content;
            if (text) controller.enqueue(encoder.encode(text));
          } catch {
            // skip malformed lines
          }
        }
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
    },
  });
}
