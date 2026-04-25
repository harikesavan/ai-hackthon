import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are a healthcare facility query agent for India.
You have access to a PostgreSQL database with a table called "facilities" containing 10,000 Indian healthcare facilities.

Available columns:
- id, facility_name, facility_type, state, district, pincode, lat, lon
- beds, doctors, services (JSON array), equipment (JSON array), specialties (JSON array)
- emergency_available (boolean), operating_hours
- extraction_confidence (high/medium/low)
- unsupported_claims (JSON array of {field, value, reason})
- rule_violations (JSON array of {rule, description, citation})
- peer_anomaly_percentile (0-100, higher = more suspicious)
- trust_min (0.0-1.0, lower = less trustworthy)
- review_status (pending/confirmed_real/confirmed_ghost/needs_visit)
- raw_notes (original unstructured text)

When the user asks a question:
1. Generate a read-only SELECT SQL query to answer it
2. ALWAYS include trust_min, extraction_confidence, rule_violations in your results
3. Order results by trust_min DESC (most trustworthy first) unless asked otherwise
4. If no results match, find the NEAREST alternative (expand the search area or relax criteria)
5. NEVER return empty results — always suggest an alternative
6. For JSON array columns, use @> operator for containment or cast with ::text and ILIKE for searching

Respond with ONLY a JSON object:
{"sql": "SELECT ...", "explanation": "Brief explanation of what this query does"}`;

export async function POST(request: NextRequest) {
  const { message } = await request.json();

  if (!message) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: message },
      ],
      temperature: 0,
      response_format: { type: "json_object" },
    });

    const response = JSON.parse(
      completion.choices[0].message.content || "{}"
    );

    if (!response.sql) {
      return NextResponse.json({
        answer: "I couldn't generate a query for that question.",
        facilities: [],
      });
    }

    const forbidden = ["INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "TRUNCATE", "CREATE"];
    const upperSql = response.sql.toUpperCase();
    if (forbidden.some((keyword) => upperSql.includes(keyword))) {
      return NextResponse.json({
        answer: "Query blocked for safety.",
        facilities: [],
      });
    }

    const results = await db.execute(sql.raw(response.sql));

    const answerCompletion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a healthcare analyst. Given query results about Indian healthcare facilities, provide a clear answer. 
For each facility mentioned, include its trust signals:
- Extraction confidence
- Number of rule violations with the most important one cited
- Peer anomaly percentile if notable (>90th)
Always mention if a facility has low trust and WHY specifically.
If results show facilities with trust issues, lead with that finding.
Be concise but cite specific data.`,
        },
        {
          role: "user",
          content: `Question: ${message}\n\nQuery results (${
            Array.isArray(results) ? results.length : 0
          } rows):\n${JSON.stringify(results, null, 2).slice(0, 8000)}`,
        },
      ],
      temperature: 0.3,
    });

    return NextResponse.json({
      answer: answerCompletion.choices[0].message.content,
      facilities: Array.isArray(results) ? results.slice(0, 20) : [],
      query: response.sql,
      explanation: response.explanation,
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Chat API error:", errorMessage);
    return NextResponse.json(
      { error: "Failed to process query", details: errorMessage },
      { status: 500 }
    );
  }
}
