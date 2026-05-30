import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { Holding } from "@/types";

const client = new Anthropic();

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
- 最終的な投資判断はユーザー自身が行う必要があります
- 分散投資やリスク管理の重要性を適切に伝えてください`;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const anthropicStream = client.messages.stream({
        model: "claude-opus-4-7",
        max_tokens: 1024,
        thinking: { type: "adaptive" },
        system: systemPrompt,
        messages: messages.map((m: { role: string; content: string }) => ({
          role: m.role,
          content: m.content,
        })),
      });

      for await (const event of anthropicStream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          controller.enqueue(encoder.encode(event.delta.text));
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
