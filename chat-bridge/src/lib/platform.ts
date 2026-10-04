import { execFile } from "child_process";

export function isMacOS(): boolean {
  return process.platform === "darwin";
}

export function preferDemoMode(): boolean {
  if ((process.env.DEMO_MODE || "").toLowerCase() === "true") return true;
  if ((process.env.DEMO_MODE || "").toLowerCase() === "false") return false;
  return !isMacOS();
}

export async function runOsascript(source: string): Promise<string> {
  if (!isMacOS()) {
    throw new Error("AppleScript kräver macOS med Mail och Kalender installerade.");
  }
  try {
    const { stdout } = await new Promise<{ stdout: string; stderr: string }>(
      (resolve, reject) => {
        const child = execFile(
          "osascript",
          [],
          { timeout: 30000, maxBuffer: 2 * 1024 * 1024 },
          (error, stdout, stderr) => {
            if (error) {
              (error as { stderr?: string }).stderr = stderr;
              reject(error);
              return;
            }
            resolve({ stdout, stderr });
          },
        );
        child.stdin?.end(source);
      },
    );
    return stdout.trim();
  } catch (error) {
    const err = error as { stderr?: string; message?: string };
    const detail = err.stderr?.trim() || err.message || "Okänt AppleScript-fel";
    throw new Error(
      `Kunde inte prata med Apple-apparna. Ge Terminal/Cursor behörighet under ` +
        `Systeminställningar → Integritet och säkerhet → Automatisering (Mail + Kalender). ` +
        `Detalj: ${detail}`,
    );
  }
}

export async function probeAppleApps(): Promise<{
  platform: string;
  demoMode: boolean;
  calendarReachable: boolean;
  mailReachable: boolean;
  message: string;
}> {
  const demoMode = preferDemoMode();
  if (!isMacOS()) {
    return {
      platform: process.platform,
      demoMode: true,
      calendarReachable: false,
      mailReachable: false,
      message:
        "Körs inte på macOS. Demoläge är aktivt. Starta appen lokalt på din Mac för att koppla Mail och Kalender.",
    };
  }

  if (demoMode) {
    return {
      platform: "darwin",
      demoMode: true,
      calendarReachable: false,
      mailReachable: false,
      message: "Demoläge är påslaget via DEMO_MODE=true.",
    };
  }

  let calendarReachable = false;
  let mailReachable = false;

  try {
    await runOsascript('tell application "Calendar" to get name');
    calendarReachable = true;
  } catch {
    calendarReachable = false;
  }

  try {
    await runOsascript('tell application "Mail" to get name');
    mailReachable = true;
  } catch {
    mailReachable = false;
  }

  const parts: string[] = [];
  if (calendarReachable) parts.push("Kalender");
  if (mailReachable) parts.push("Mail");

  return {
    platform: "darwin",
    demoMode: false,
    calendarReachable,
    mailReachable,
    message:
      parts.length > 0
        ? `Ansluten till ${parts.join(" och ")} på den här Macen. Ändringar synkas till iPhone via iCloud om samma Apple‑ID används.`
        : "macOS hittades men Mail/Kalender svarade inte. Tillåt Automatisering för appen som kör servern.",
  };
}
