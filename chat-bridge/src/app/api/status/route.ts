import { NextResponse } from "next/server";
import { preferDemoMode, probeAppleApps } from "@/lib/platform";

export const runtime = "nodejs";

export async function GET() {
  const apple = await probeAppleApps();
  return NextResponse.json({
    ...apple,
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    demoMode: preferDemoMode() || apple.demoMode,
  });
}
