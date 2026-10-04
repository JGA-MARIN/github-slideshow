import type OpenAI from "openai";
import { createCalendarEvent, listCalendarEvents } from "./apple/calendar";
import { composeOrSendEmail, listEmails, readEmail } from "./apple/mail";

export const toolDefinitions: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "list_calendar_events",
      description:
        "Lista kommande händelser från macOS Kalender-appen (synkas till iPhone via iCloud).",
      parameters: {
        type: "object",
        properties: {
          daysAhead: {
            type: "number",
            description: "Hur många dagar framåt som ska hämtas (standard 7).",
          },
          query: {
            type: "string",
            description: "Valfri söktext i händelsens titel.",
          },
          maxResults: {
            type: "number",
            description: "Max antal händelser att returnera.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_calendar_event",
      description:
        "Skapa en ny händelse i macOS Kalender-appen. Använd ISO-8601 datum/tid.",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string", description: "Titel på händelsen." },
          start: {
            type: "string",
            description: "Starttid i ISO-8601, t.ex. 2026-10-05T10:00:00.",
          },
          end: {
            type: "string",
            description: "Sluttid i ISO-8601, t.ex. 2026-10-05T11:00:00.",
          },
          location: { type: "string" },
          description: { type: "string" },
          calendarName: {
            type: "string",
            description: "Valfri kalender (annars första kalendern).",
          },
        },
        required: ["summary", "start", "end"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_emails",
      description: "Lista senaste mejl från macOS Mail-appen (inkorgen).",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Sök i ämne eller avsändare.",
          },
          maxResults: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_email",
      description: "Läs hela innehållet i ett mejl via dess id.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "Mejlets id från list_emails." },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_email",
      description:
        "Skapa och skicka (eller bara öppna utkast) i macOS Mail-appen.",
      parameters: {
        type: "object",
        properties: {
          to: { type: "string" },
          subject: { type: "string" },
          body: { type: "string" },
          send: {
            type: "boolean",
            description:
              "true = skicka direkt, false = öppna utkast i Mail. Standard true.",
          },
        },
        required: ["to", "subject", "body"],
      },
    },
  },
];

export async function executeTool(
  name: string,
  argsJson: string,
): Promise<unknown> {
  const args = argsJson ? JSON.parse(argsJson) : {};

  switch (name) {
    case "list_calendar_events":
      return listCalendarEvents(args);
    case "create_calendar_event":
      return createCalendarEvent(args);
    case "list_emails":
      return listEmails(args);
    case "read_email":
      return readEmail(args);
    case "send_email":
      return composeOrSendEmail(args);
    default:
      return { error: `Okänt verktyg: ${name}` };
  }
}

export const systemPrompt = `Du är Brygga – en assistent som kopplar ChatGPT till användarens Apple Mail och Kalender på Mac.
Ändringar i Mail/Kalender på Mac synkas till iPhone när samma Apple‑ID och iCloud används.

Regler:
- Svara på svenska om användaren skriver svenska.
- Använd verktygen för att läsa/skriva kalender och mejl i stället för att gissa.
- När du skapar händelser: bekräfta tid, plats och titel tydligt.
- När du skickar mejl: visa mottagare, ämne och kort sammanfattning innan du skickar om användaren inte redan bekräftat.
- Om verktyg körs i demoläge, säg det kort så användaren förstår att det inte är riktiga Apple-appar.
- Var konkret och hjälpsam. Undvik onödig jargong.`;
