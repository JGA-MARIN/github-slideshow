import { executeTool } from "./tools";

type Trace = { name: string; result: unknown };

function formatEvents(result: unknown): string {
  const data = result as {
    mode?: string;
    events?: Array<{
      summary?: string;
      start?: string;
      end?: string;
      location?: string;
    }>;
  };
  const events = data.events || [];
  if (!events.length) return "Jag hittade inga händelser i kalendern.";
  const lines = events.map((e) => {
    const when = e.start
      ? new Date(e.start).toLocaleString("sv-SE")
      : "okänd tid";
    const loc = e.location ? ` · ${e.location}` : "";
    return `• ${e.summary} — ${when}${loc}`;
  });
  return `Här är vad som finns i kalendern (${data.mode === "demo" ? "demoläge" : "Apple Kalender"}):\n${lines.join("\n")}`;
}

function formatEmails(result: unknown): string {
  const data = result as {
    mode?: string;
    emails?: Array<{ from?: string; subject?: string; snippet?: string; date?: string }>;
  };
  const emails = data.emails || [];
  if (!emails.length) return "Inkorgen ser tom ut.";
  const lines = emails.map((m) => {
    const when = m.date ? new Date(m.date).toLocaleString("sv-SE") : "";
    return `• ${m.subject}\n  från ${m.from}${when ? ` · ${when}` : ""}\n  ${m.snippet || ""}`;
  });
  return `Senaste mejl (${data.mode === "demo" ? "demoläge" : "Apple Mail"}):\n\n${lines.join("\n\n")}`;
}

export async function runDemoChat(userText: string): Promise<{
  reply: string;
  toolsUsed: string[];
  toolTrace: Trace[];
}> {
  const text = userText.toLowerCase();
  const toolTrace: Trace[] = [];

  const run = async (name: string, args: Record<string, unknown>) => {
    const result = await executeTool(name, JSON.stringify(args));
    toolTrace.push({ name, result });
    return result;
  };

  if (
    text.includes("kalender") ||
    text.includes("schema") ||
    text.includes("möte") ||
    text.includes("boka") ||
    text.includes("lunch")
  ) {
    if (text.includes("boka") || text.includes("skapa") || text.includes("lunch")) {
      const start = new Date();
      start.setDate(start.getDate() + 1);
      start.setHours(12, 0, 0, 0);
      const end = new Date(start);
      end.setHours(13, 0, 0, 0);
      const created = await run("create_calendar_event", {
        summary: text.includes("lunch") ? "Lunch" : "Ny händelse",
        start: start.toISOString(),
        end: end.toISOString(),
        location: text.includes("lunch") ? "Café Norr" : undefined,
      });
      const list = await run("list_calendar_events", { daysAhead: 7 });
      return {
        reply:
          `Jag skapade en händelse i demoläget (lägg in OPENAI_API_KEY för riktig ChatGPT-styrning).\n\n` +
          `${JSON.stringify((created as { event?: unknown }).event, null, 2)}\n\n` +
          formatEvents(list),
        toolsUsed: toolTrace.map((t) => t.name),
        toolTrace,
      };
    }

    const list = await run("list_calendar_events", { daysAhead: 7 });
    return {
      reply:
        "Demoläge utan OpenAI-nyckel — jag läser mockad kalenderdata.\n\n" +
        formatEvents(list),
      toolsUsed: toolTrace.map((t) => t.name),
      toolTrace,
    };
  }

  if (text.includes("mejl") || text.includes("mail") || text.includes("inkorg")) {
    if (text.includes("svar") || text.includes("skriv")) {
      const list = await run("list_emails", { maxResults: 3 });
      const emails = (list as { emails?: Array<{ from?: string; subject?: string }> }).emails || [];
      const latest = emails[0];
      if (latest?.from) {
        await run("send_email", {
          to: latest.from,
          subject: `Re: ${latest.subject || ""}`,
          body: "Tack för mejlet — jag återkommer mer i detalj snart.\n\n/Brygga (demoläge)",
          send: true,
        });
      }
      return {
        reply:
          "Demoläge: jag skapade ett mockat svarsmejl baserat på senaste inkommande.\n\n" +
          formatEmails(list),
        toolsUsed: toolTrace.map((t) => t.name),
        toolTrace,
      };
    }

    const list = await run("list_emails", { maxResults: 5 });
    return {
      reply:
        "Demoläge utan OpenAI-nyckel — jag läser mockad mejldata.\n\n" +
        formatEmails(list),
      toolsUsed: toolTrace.map((t) => t.name),
      toolTrace,
    };
  }

  return {
    reply:
      "Demoläge är aktivt och OPENAI_API_KEY saknas. Fråga t.ex. om kalendern eller senaste mejl, " +
      "eller lägg in din OpenAI-nyckel i `.env.local` för full ChatGPT-styrning av Mail och Kalender på Mac.",
    toolsUsed: [],
    toolTrace: [],
  };
}
