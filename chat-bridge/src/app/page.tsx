"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import styles from "./page.module.css";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  toolsUsed?: string[];
};

type Status = {
  platform: string;
  demoMode: boolean;
  calendarReachable: boolean;
  mailReachable: boolean;
  openaiConfigured: boolean;
  model: string;
  message: string;
};

const SUGGESTIONS = [
  "Vad har jag i kalendern de närmaste dagarna?",
  "Visa mina senaste mejl",
  "Boka lunch med Anna imorgon kl 12–13",
  "Skriv ett kort svar på senaste mejlet",
];

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((data: Status) => setStatus(data))
      .catch(() =>
        setStatus({
          platform: "unknown",
          demoMode: true,
          calendarReachable: false,
          mailReachable: false,
          openaiConfigured: false,
          model: "gpt-4o-mini",
          message: "Kunde inte läsa status.",
        }),
      );
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const nextMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: trimmed },
    ];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map(({ role, content }) => ({ role, content })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "ChatGPT svarade inte.");
      }
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply,
          toolsUsed: data.toolsUsed,
        },
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Något gick fel.";
      setError(message);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Jag kunde inte slutföra det: ${message}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void sendMessage(input);
  }

  return (
    <main className={styles.shell}>
      <header className={styles.hero}>
        <h1 className={styles.brand}>Brygga</h1>
        <p className={styles.tagline}>
          ChatGPT kopplad till din Macs Mail och Kalender – samma appar som synkar
          till iPhone via iCloud.
        </p>
        <div className={styles.statusRow}>
          <span
            className={`${styles.chip} ${
              status?.openaiConfigured ? styles.chipOk : styles.chipWarn
            }`}
          >
            {status?.openaiConfigured
              ? `ChatGPT · ${status.model}`
              : "ChatGPT · demoläge (saknar API-nyckel)"}
          </span>
          <span
            className={`${styles.chip} ${
              status?.calendarReachable ? styles.chipOk : styles.chipWarn
            }`}
          >
            {status?.demoMode
              ? "Kalender · demoläge"
              : status?.calendarReachable
                ? "Kalender · ansluten"
                : "Kalender · ej ansluten"}
          </span>
          <span
            className={`${styles.chip} ${
              status?.mailReachable ? styles.chipOk : styles.chipWarn
            }`}
          >
            {status?.demoMode
              ? "Mail · demoläge"
              : status?.mailReachable
                ? "Mail · ansluten"
                : "Mail · ej ansluten"}
          </span>
        </div>
      </header>

      <section className={styles.panel} aria-label="Chatt">
        <div className={styles.messages}>
          {messages.length === 0 ? (
            <div className={styles.empty}>
              <h2 className={styles.emptyTitle}>Vad vill du göra?</h2>
              <p className={styles.emptyText}>
                Fråga om schemat, låt Brygga läsa inkorg eller skapa en händelse
                direkt i Kalender-appen.
              </p>
              <div className={styles.suggestions}>
                {SUGGESTIONS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={styles.suggestion}
                    onClick={() => void sendMessage(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`${styles.bubble} ${
                  message.role === "user" ? styles.user : styles.assistant
                }`}
              >
                {message.content}
                {message.toolsUsed && message.toolsUsed.length > 0 ? (
                  <div className={styles.meta}>
                    Använde: {message.toolsUsed.join(", ")}
                  </div>
                ) : null}
              </div>
            ))
          )}
          {loading ? (
            <div className={`${styles.bubble} ${styles.assistant}`}>Tänker…</div>
          ) : null}
          <div ref={endRef} />
        </div>

        <form className={styles.composer} onSubmit={onSubmit}>
          <textarea
            className={styles.input}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Skriv till Brygga…"
            rows={2}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendMessage(input);
              }
            }}
          />
          <button className={styles.send} type="submit" disabled={loading || !input.trim()}>
            Skicka
          </button>
        </form>
      </section>

      <p className={styles.footnote}>
        {status?.message || "Hämtar status…"}
        {error ? ` Fel: ${error}` : ""} Kör appen på din Mac, ge Automatisering-behörighet
        till Mail och Kalender, och se till att iCloud synkar till iPhone.
      </p>
    </main>
  );
}
