import { NextResponse } from "next/server";
import OpenAI from "openai";
import { executeTool, systemPrompt, toolDefinitions } from "@/lib/tools";

export const runtime = "nodejs";

type ClientMessage = {
  role: "user" | "assistant";
  content: string;
};

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          error:
            "OPENAI_API_KEY saknas. Lägg nyckeln i chat-bridge/.env.local och starta om servern.",
        },
        { status: 400 },
      );
    }

    const body = (await request.json()) as { messages?: ClientMessage[] };
    const messages = body.messages || [];
    if (!messages.length) {
      return NextResponse.json({ error: "Inga meddelanden skickades." }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    const conversation: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    ];

    const toolTrace: Array<{ name: string; result: unknown }> = [];
    let finalText = "";

    for (let step = 0; step < 6; step += 1) {
      const completion = await openai.chat.completions.create({
        model,
        messages: conversation,
        tools: toolDefinitions,
        tool_choice: "auto",
        temperature: 0.4,
      });

      const choice = completion.choices[0];
      const message = choice.message;
      conversation.push(message);

      const toolCalls = message.tool_calls || [];
      if (!toolCalls.length) {
        finalText = message.content || "";
        break;
      }

      for (const call of toolCalls) {
        if (call.type !== "function") continue;
        const name = call.function.name;
        const argText = call.function.arguments || "{}";
        let result: unknown;
        try {
          result = await executeTool(name, argText);
        } catch (error) {
          result = {
            error: error instanceof Error ? error.message : "Verktyget misslyckades",
          };
        }
        toolTrace.push({ name, result });
        conversation.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }
    }

    if (!finalText) {
      finalText =
        "Jag hämtade data från Mail/Kalender men fick inget slutligt svar. Försök gärna igen.";
    }

    return NextResponse.json({
      reply: finalText,
      toolsUsed: toolTrace.map((t) => t.name),
      toolTrace,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Något gick fel i chatten mot ChatGPT.",
      },
      { status: 500 },
    );
  }
}
