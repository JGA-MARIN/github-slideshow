# Brygga – ChatGPT ↔ Apple Mail & Kalender

Lokal brygg-app som låter **ChatGPT** läsa och skriva i **macOS Mail** och **Kalender**.  
På iPhone syns samma mejl och händelser via **iCloud** när du använder samma Apple‑ID.

> Appen måste köras på en **Mac**. iPhone har inget öppet API för att styra Mail-appen på samma sätt; Mac-apparna är bryggan, iCloud tar det till telefonen.

## Vad den gör

- Chattar med ChatGPT (OpenAI API)
- Listar och skapar händelser i **Kalender.app** via AppleScript
- Listar, läser och skickar mejl i **Mail.app** via AppleScript
- Faller tillbaka till **demoläge** automatiskt utanför macOS
- Utan `OPENAI_API_KEY` finns ett enkelt demoläge för kalender/mejl-frågor (full ChatGPT-styrning kräver nyckel)

## Kom igång (på din Mac)

```bash
cd chat-bridge
cp .env.example .env.local
# Lägg in OPENAI_API_KEY i .env.local
npm install
npm run dev
```

Öppna [http://localhost:3000](http://localhost:3000).

### Behörigheter på macOS

När Brygga först pratar med apparna frågar macOS om **Automatisering**:

1. Systeminställningar → Integritet och säkerhet → Automatisering  
2. Tillåt den app som kör servern (Terminal, iTerm, Cursor, osv.) att styra **Mail** och **Kalender**
3. Se även till att Mail och Kalender får behövd kalender-/mejlåtkomst

### iPhone

1. Logga in med samma Apple‑ID på Mac och iPhone  
2. Aktivera iCloud Mail och iCloud-kalender  
3. Skapa/ändra via Brygga på Mac → synkas till iPhone

## Miljövariabler

| Variabel | Beskrivning |
|---|---|
| `OPENAI_API_KEY` | Din OpenAI-nyckel |
| `OPENAI_MODEL` | Standard `gpt-4o-mini` |
| `DEMO_MODE` | `true` tvingar mockdata; utanför macOS är demoläge automatiskt på |

## Exempel på frågor

- ”Vad har jag i kalendern de närmaste dagarna?”
- ”Visa mina senaste mejl”
- ”Boka lunch imorgon 12–13”
- ”Skriv ett utkast till svar på senaste mejlet”

## Begränsningar

- Kräver lokal Mac med Mail och Kalender installerade
- AppleScript kan behöva justeras om du har många konton/brevlådor
- Skickade mejl går via ditt konto i Mail.app – granska känsliga utskick
- Det här är **inte** en inbyggd ChatGPT-plugin från OpenAI; det är en lokal brygga du kör själv
