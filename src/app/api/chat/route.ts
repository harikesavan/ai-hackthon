import { NextRequest } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { streamAgent } from "@/lib/agent";

const DATA_DIR = join(process.cwd(), "data");

const CACHE_MAP: Record<string, string[]> = {
  "c-section": ["demo-cache/query1-patna-csection.json", "demo_cache1.json"],
  patna: ["demo-cache/query1-patna-csection.json", "demo_cache1.json"],
  obstetric: ["demo-cache/query1-patna-csection.json", "demo_cache1.json"],
  pregnant: ["demo-cache/query1-patna-csection.json", "demo_cache1.json"],
  cardiac: ["demo-cache/query2-rajasthan-cardiac.json", "demo_cache2.json"],
  heart: ["demo-cache/query2-rajasthan-cardiac.json", "demo_cache2.json"],
  rajasthan: ["demo-cache/query2-rajasthan-cardiac.json", "demo_cache2.json"],
  chennai: ["demo-cache/query3-chennai-surgery.json", "demo_cache3.json"],
  surgery: ["demo-cache/query3-chennai-surgery.json", "demo_cache3.json"],
  tamil: ["demo-cache/query3-chennai-surgery.json", "demo_cache3.json"],
  bihar: ["demo-cache/query1-patna-csection.json", "demo_cache1.json"],
  emergency: ["demo-cache/query1-patna-csection.json", "demo_cache1.json"],
  dental: ["demo-cache/query3-chennai-surgery.json", "demo_cache3.json"],
};

type Highlight = { type: "red" | "green"; facilityId: number; lat: number; lon: number };
type ReasoningStep = { step: string; text: string; delay?: number; highlight?: Highlight };
type Warning = { facilityId: number; name: string; trustMin: number; reason: string };
type Recommendation = {
  facilityId: number;
  name: string;
  type?: string;
  district?: string;
  state?: string;
  lat: number;
  lon: number;
  trustMin: number;
  reason: string;
};
type MapStateType = {
  center: [number, number];
  zoom: number;
  highlightGreen: number[];
  highlightRed: number[];
};
type CachedResponse = {
  query: string;
  recommendation: Recommendation | null;
  reasoning: ReasoningStep[];
  warnings: Warning[];
  mapState: MapStateType | null;
};

function findCachedResponse(message: string): CachedResponse | null {
  const lower = message.toLowerCase();
  for (const [keyword, filenames] of Object.entries(CACHE_MAP)) {
    const pattern = new RegExp(`(?:^|\\s|[^a-z])${keyword}(?:$|\\s|[^a-z])`);
    if (pattern.test(lower)) {
      for (const filename of filenames) {
        const filepath = join(DATA_DIR, filename);
        if (existsSync(filepath)) {
          return JSON.parse(readFileSync(filepath, "utf-8"));
        }
      }
    }
  }
  return null;
}

type SessionTurn = {
  userMessage: string;
  diagnosis: string | null;
  location: string | null;
  recommendation: Recommendation | null;
};

type Session = {
  turns: SessionTurn[];
  createdAt: number;
};

const sessions = new Map<string, Session>();
const SESSION_TTL_MS = 30 * 60 * 1000;

function getSession(sessionId: string): Session {
  let session = sessions.get(sessionId);
  if (!session) {
    session = { turns: [], createdAt: Date.now() };
    sessions.set(sessionId, session);
  }
  return session;
}

function pruneOldSessions() {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.createdAt > SESSION_TTL_MS) sessions.delete(id);
  }
}

function buildHistoryFromSession(session: Session): Array<{ role: "user" | "assistant"; content: string }> {
  const entries: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const turn of session.turns) {
    entries.push({ role: "user", content: turn.userMessage });
    const parts: string[] = [];
    if (turn.diagnosis) parts.push(turn.diagnosis);
    if (turn.location) parts.push(turn.location);
    if (turn.recommendation) {
      parts.push(
        `Recommended: ${turn.recommendation.name} (${turn.recommendation.district ?? ""}, ${turn.recommendation.state ?? ""}) — trust ${Math.round(turn.recommendation.trustMin * 100)}%`,
      );
    }
    if (parts.length > 0) {
      entries.push({ role: "assistant", content: parts.join(" | ") });
    }
  }
  return entries.slice(-12);
}

function buildContextPrefix(session: Session): string {
  if (session.turns.length === 0) return "";
  const last = session.turns[session.turns.length - 1];
  const parts: string[] = [];
  if (last.diagnosis) parts.push(last.diagnosis);
  if (last.location) parts.push(last.location);
  if (last.recommendation) {
    parts.push(`Previous recommendation: ${last.recommendation.name} in ${last.recommendation.district ?? last.recommendation.state ?? "unknown"}`);
  }
  return parts.length > 0 ? `[Context from previous search: ${parts.join(". ")}] ` : "";
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { message, mode, demoMode, sessionId: rawSessionId } = body;

  if (!message) {
    return new Response(JSON.stringify({ error: "Message is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  pruneOldSessions();

  const sessionId = typeof rawSessionId === "string" && rawSessionId ? rawSessionId : `anon-${Date.now()}`;
  const session = getSession(sessionId);

  const resolvedMode: "demo" | "live" =
    mode === "live" || mode === "demo" ? mode : demoMode === false ? "live" : "demo";

  const contextPrefix = session.turns.length > 0 ? buildContextPrefix(session) : "";
  const enrichedMessage = contextPrefix && !message.startsWith("[Context")
    ? contextPrefix + message
    : message;

  const history = buildHistoryFromSession(session);

  const currentTurn: SessionTurn = {
    userMessage: message,
    diagnosis: null,
    location: null,
    recommendation: null,
  };
  session.turns.push(currentTurn);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, payload: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`),
        );

        if (event === "reasoning") {
          const step = payload as { step?: string; text?: string };
          if (step.step === "diagnose" && step.text) currentTurn.diagnosis = step.text;
          if (step.step === "locate" && step.text) currentTurn.location = step.text;
        }
        if (event === "recommendation") {
          currentTurn.recommendation = payload as Recommendation;
        }
      };

      send("session", { sessionId });

      try {
        if (resolvedMode === "demo") {
          const cached = findCachedResponse(message);
          if (!cached) {
            send("query", { query: message });
            send("reasoning", {
              step: "error",
              text: "Demo mode only supports preset queries. Try 'Hospital near Patna for C-section', 'Cardiac care in Rajasthan', 'Surgery facility in Chennai', or switch to Live mode.",
            });
            send("done", {});
            controller.close();
            return;
          }

          send("query", { query: cached.query });
          for (const step of cached.reasoning) {
            const delay = step.delay ?? 800;
            await new Promise((r) => setTimeout(r, delay));
            send("reasoning", { step: step.step, text: step.text });
            if (step.highlight) {
              send("highlight", step.highlight);
            }
          }
          if (cached.warnings.length > 0) {
            await new Promise((r) => setTimeout(r, 400));
            send("warnings", cached.warnings);
          }
          if (cached.recommendation) {
            await new Promise((r) => setTimeout(r, 400));
            send("recommendation", cached.recommendation);
          }
          if (cached.mapState) {
            send("mapState", cached.mapState);
          }
          send("done", {});
          controller.close();
          return;
        }

        await streamAgent(enrichedMessage, history, send);
        controller.close();
      } catch (error) {
        send("reasoning", {
          step: "error",
          text: `Live agent failed: ${error instanceof Error ? error.message : "unknown error"}. Try again or switch to Demo mode.`,
        });
        send("done", {});
        controller.close();
      }
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
