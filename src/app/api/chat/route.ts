import { NextRequest } from "next/server";
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

type Highlight = { type: "red" | "green"; facilityId: number; lat: number; lon: number };
type ReasoningStep = { step: string; text: string; delay?: number; highlight?: Highlight };
type Warning = { facilityId: number; name: string; trustMin: number; reason: string };
type Recommendation = {
  facilityId: number; name: string; type: string;
  district: string; state: string; lat: number; lon: number;
  trustMin: number; reason: string;
};
type MapStateType = {
  center: [number, number]; zoom: number;
  highlightGreen: number[]; highlightRed: number[];
};
type AgentResponse = {
  query: string;
  recommendation: Recommendation | null;
  reasoning: ReasoningStep[];
  warnings: Warning[];
  mapState: MapStateType | null;
};

function findCachedResponse(message: string): AgentResponse | null {
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

async function getAgentResponse(message: string, demoMode: boolean): Promise<AgentResponse> {
  if (demoMode) {
    const cached = findCachedResponse(message);
    if (cached) return cached;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const res = await fetch(AGENT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    if (!res.ok) throw new Error(`Agent returned ${res.status}`);
    return await res.json();
  } catch {
    const cached = findCachedResponse(message);
    if (cached) return cached;

    return {
      query: message,
      recommendation: null,
      reasoning: [{ step: "error", text: "Could not process this query. Try a suggested question." }],
      warnings: [],
      mapState: null,
    };
  }
}

export async function POST(request: NextRequest) {
  const { message, demoMode } = await request.json();

  if (!message) {
    return new Response(JSON.stringify({ error: "Message is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const data = await getAgentResponse(message, demoMode ?? false);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, payload: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`));
      };

      send("query", { query: data.query });

      for (const step of data.reasoning) {
        const delay = (step as ReasoningStep).delay ?? 800;
        await new Promise((r) => setTimeout(r, delay));
        send("reasoning", { step: step.step, text: step.text });

        if ((step as ReasoningStep).highlight) {
          send("highlight", (step as ReasoningStep).highlight);
        }
      }

      if (data.warnings.length > 0) {
        await new Promise((r) => setTimeout(r, 400));
        send("warnings", data.warnings);
      }

      if (data.recommendation) {
        await new Promise((r) => setTimeout(r, 400));
        send("recommendation", data.recommendation);
      }

      if (data.mapState) {
        send("mapState", data.mapState);
      }

      send("done", {});
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
