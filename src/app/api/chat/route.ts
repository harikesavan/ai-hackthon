import { NextRequest, NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const AGENT_URL = process.env.AGENT_URL || "http://localhost:8000/query";

const DEMO_CACHE_DIR = join(process.cwd(), "data", "demo-cache");

const CACHE_MAP: Record<string, string> = {
  "c-section": "query1-patna-csection.json",
  "patna": "query1-patna-csection.json",
  "obstetric": "query1-patna-csection.json",
  "pregnant": "query1-patna-csection.json",
  "cardiac": "query2-rajasthan-cardiac.json",
  "heart": "query2-rajasthan-cardiac.json",
  "rajasthan": "query2-rajasthan-cardiac.json",
  "chennai": "query3-chennai-surgery.json",
  "surgery": "query3-chennai-surgery.json",
  "tamil": "query3-chennai-surgery.json",
};

function findCachedResponse(message: string): unknown | null {
  const lower = message.toLowerCase();
  for (const [keyword, filename] of Object.entries(CACHE_MAP)) {
    if (lower.includes(keyword)) {
      const filepath = join(DEMO_CACHE_DIR, filename);
      if (existsSync(filepath)) {
        return JSON.parse(readFileSync(filepath, "utf-8"));
      }
    }
  }
  return null;
}

export async function POST(request: NextRequest) {
  const { message, demoMode } = await request.json();

  if (!message) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  if (demoMode) {
    const cached = findCachedResponse(message);
    if (cached) {
      return NextResponse.json(cached);
    }
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const agentResponse = await fetch(AGENT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!agentResponse.ok) {
      throw new Error(`Agent returned ${agentResponse.status}`);
    }

    const result = await agentResponse.json();
    return NextResponse.json(result);
  } catch {
    const cached = findCachedResponse(message);
    if (cached) {
      return NextResponse.json(cached);
    }

    return NextResponse.json({
      query: message,
      recommendation: null,
      reasoning: [
        {
          step: "error",
          text: "Could not process this query right now. Try one of the suggested questions.",
        },
      ],
      warnings: [],
      mapState: null,
    });
  }
}
