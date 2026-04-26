import OpenAI from "openai";
import { db } from "@/lib/db";
import { facilities } from "@/lib/db/schema";
import { and, eq, ilike, isNotNull, or, sql } from "drizzle-orm";
import {
  SYSTEM_PROMPT,
  FOLLOWUP_PROMPT,
  VALIDATOR_PROMPT,
  REFINE_PROMPT,
  REASONING_MODEL,
  REASONING_FALLBACK,
  FOLLOWUP_MODEL,
  VALIDATOR_MODEL,
  REFINE_MODEL,
} from "@/lib/prompts";

export type AgentReasoningStep = { step: string; text: string };
export type AgentWarning = {
  facilityId: number;
  name: string;
  lat?: number;
  lon?: number;
  trustMin: number;
  reason: string;
};
export type AgentRecommendation = {
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
export type AgentResponse = {
  query: string;
  recommendation: AgentRecommendation | null;
  reasoning: AgentReasoningStep[];
  warnings: AgentWarning[];
  alternatives?: AgentRecommendation[];
  mapState: { center: [number, number]; zoom: number; highlightGreen: number[]; highlightRed: number[] } | null;
};

type HistoryEntry = { role: "user" | "assistant"; content: string };

type ConditionAnalysis = {
  condition: string;
  ageGroup: "child" | "adult" | "elderly" | "any";
  urgency: "emergency" | "high" | "medium" | "low";
  coreSpecialtyTerms: string[];
  fallbackSpecialtyTerms: string[];
  specialtyLabels: string[];
  excludeKeywords: string[];
  preferredFacilityTypes: string[];
  maxReasonableDistanceKm: number;
  state?: string | null;
  district?: string | null;
  pincode?: string | null;
  rationale: string;
};

const PINCODE_MAP: Record<string, { lat: number; lon: number; state: string; district: string }> = {
  "110": { lat: 28.6139, lon: 77.209, state: "Delhi", district: "New Delhi" },
  "400": { lat: 19.076, lon: 72.8777, state: "Maharashtra", district: "Mumbai" },
  "411": { lat: 18.5204, lon: 73.8567, state: "Maharashtra", district: "Pune" },
  "560": { lat: 12.9716, lon: 77.5946, state: "Karnataka", district: "Bengaluru" },
  "600": { lat: 13.0827, lon: 80.2707, state: "Tamil Nadu", district: "Chennai" },
  "620": { lat: 10.7905, lon: 78.7047, state: "Tamil Nadu", district: "Tiruchirappalli" },
  "625": { lat: 9.9252, lon: 78.1198, state: "Tamil Nadu", district: "Madurai" },
  "641": { lat: 11.0168, lon: 76.9558, state: "Tamil Nadu", district: "Coimbatore" },
  "700": { lat: 22.5726, lon: 88.3639, state: "West Bengal", district: "Kolkata" },
  "500": { lat: 17.385, lon: 78.4867, state: "Telangana", district: "Hyderabad" },
  "302": { lat: 26.9124, lon: 75.7873, state: "Rajasthan", district: "Jaipur" },
  "342": { lat: 26.2389, lon: 73.0243, state: "Rajasthan", district: "Jodhpur" },
  "313": { lat: 24.5854, lon: 73.7125, state: "Rajasthan", district: "Udaipur" },
  "800": { lat: 25.5941, lon: 85.1376, state: "Bihar", district: "Patna" },
  "823": { lat: 24.7914, lon: 85.0002, state: "Bihar", district: "Gaya" },
  "834": { lat: 23.3441, lon: 85.3096, state: "Jharkhand", district: "Ranchi" },
  "380": { lat: 23.0225, lon: 72.5714, state: "Gujarat", district: "Ahmedabad" },
  "395": { lat: 21.1702, lon: 72.8311, state: "Gujarat", district: "Surat" },
  "201": { lat: 28.6692, lon: 77.4538, state: "Uttar Pradesh", district: "Ghaziabad" },
  "226": { lat: 26.8467, lon: 80.9462, state: "Uttar Pradesh", district: "Lucknow" },
  "221": { lat: 25.3176, lon: 82.9739, state: "Uttar Pradesh", district: "Varanasi" },
  "682": { lat: 9.9312, lon: 76.2673, state: "Kerala", district: "Ernakulam" },
  "695": { lat: 8.5241, lon: 76.9366, state: "Kerala", district: "Thiruvananthapuram" },
  "751": { lat: 20.2961, lon: 85.8245, state: "Odisha", district: "Bhubaneswar" },
  "160": { lat: 30.7333, lon: 76.7794, state: "Chandigarh", district: "Chandigarh" },
};

const CITY_COORDS: Record<string, { lat: number; lon: number; state: string }> = {
  trichy: { lat: 10.7905, lon: 78.7047, state: "Tamil Nadu" },
  tiruchirappalli: { lat: 10.7905, lon: 78.7047, state: "Tamil Nadu" },
  chennai: { lat: 13.0827, lon: 80.2707, state: "Tamil Nadu" },
  madurai: { lat: 9.9252, lon: 78.1198, state: "Tamil Nadu" },
  coimbatore: { lat: 11.0168, lon: 76.9558, state: "Tamil Nadu" },
  vellore: { lat: 12.9165, lon: 79.1325, state: "Tamil Nadu" },
  patna: { lat: 25.5941, lon: 85.1376, state: "Bihar" },
  gaya: { lat: 24.7914, lon: 85.0002, state: "Bihar" },
  ranchi: { lat: 23.3441, lon: 85.3096, state: "Jharkhand" },
  bengaluru: { lat: 12.9716, lon: 77.5946, state: "Karnataka" },
  bangalore: { lat: 12.9716, lon: 77.5946, state: "Karnataka" },
  hyderabad: { lat: 17.385, lon: 78.4867, state: "Telangana" },
  mumbai: { lat: 19.076, lon: 72.8777, state: "Maharashtra" },
  pune: { lat: 18.5204, lon: 73.8567, state: "Maharashtra" },
  delhi: { lat: 28.6139, lon: 77.209, state: "Delhi" },
  jaipur: { lat: 26.9124, lon: 75.7873, state: "Rajasthan" },
  kolkata: { lat: 22.5726, lon: 88.3639, state: "West Bengal" },
  ahmedabad: { lat: 23.0225, lon: 72.5714, state: "Gujarat" },
  lucknow: { lat: 26.8467, lon: 80.9462, state: "Uttar Pradesh" },
};

function lookupPincode(pincode: string | null | undefined) {
  if (!pincode || pincode.length < 3) return null;
  const prefix = pincode.slice(0, 3);
  return PINCODE_MAP[prefix] ?? null;
}

function extractPincode(query: string): string | null {
  const match = query.match(/\b(\d{6})\b/);
  return match ? match[1] : null;
}

function extractCityCoords(query: string) {
  const lower = query.toLowerCase();
  for (const [city, coords] of Object.entries(CITY_COORDS)) {
    if (lower.includes(city)) {
      return { ...coords, name: city };
    }
  }
  return null;
}

const _geocodeCache = new Map<string, { lat: number; lon: number; state: string; name: string } | null>();

async function geocodeLocation(
  placeName: string | null | undefined,
): Promise<{ lat: number; lon: number; state: string; name: string } | null> {
  if (!placeName || placeName.length < 2) return null;

  const key = placeName.toLowerCase().trim();
  if (_geocodeCache.has(key)) return _geocodeCache.get(key) ?? null;

  const local = extractCityCoords(key);
  if (local) {
    _geocodeCache.set(key, local);
    return local;
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(placeName + ", India")}&format=json&limit=1&addressdetails=1`;
    const res = await fetch(url, {
      headers: { "User-Agent": "ArogyaMap-Hackathon/1.0" },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) { _geocodeCache.set(key, null); return null; }
    const data = (await res.json()) as Array<{
      lat: string; lon: string;
      address?: { state?: string; state_district?: string; city?: string; town?: string };
      display_name?: string;
    }>;
    if (!data[0]) { _geocodeCache.set(key, null); return null; }
    const hit = data[0];
    const state = hit.address?.state ?? "";
    const name = hit.address?.city ?? hit.address?.town ?? hit.address?.state_district ?? placeName;
    const result = { lat: parseFloat(hit.lat), lon: parseFloat(hit.lon), state, name: name.toLowerCase() };
    _geocodeCache.set(key, result);
    return result;
  } catch {
    _geocodeCache.set(key, null);
    return null;
  }
}

function extractAvoidLocations(query: string): string[] {
  const lower = query.toLowerCase();
  const avoidPattern =
    /(?:not (?:in|to|at|going to)|don'?t want to (?:go to|take .* to)|avoid|except|but not|exclude|away from)\s+([a-z]+)/g;
  const result: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = avoidPattern.exec(lower)) !== null) {
    if (match[1]) result.push(match[1]);
  }
  return result;
}

let _client: OpenAI | null = null;
function getOpenAI(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  if (!_client) _client = new OpenAI({ apiKey: key });
  return _client;
}

const FALLBACK_ANALYSIS: ConditionAnalysis = {
  condition: "general consultation",
  ageGroup: "any",
  urgency: "medium",
  coreSpecialtyTerms: ["general"],
  fallbackSpecialtyTerms: [],
  specialtyLabels: ["General Medicine"],
  excludeKeywords: [],
  preferredFacilityTypes: ["Hospital"],
  maxReasonableDistanceKm: 50,
  rationale: "Could not analyze condition. Defaulting to general medicine within 50 km.",
};



async function analyzeCondition(
  query: string,
  history: HistoryEntry[],
): Promise<ConditionAnalysis> {
  const client = getOpenAI();
  if (!client) return FALLBACK_ANALYSIS;

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: SYSTEM_PROMPT },
  ];
  for (const entry of history.slice(-6)) {
    messages.push(entry);
  }
  messages.push({ role: "user", content: query });

  async function callModel(model: string) {
    return client!.chat.completions.create({
      model,
      response_format: { type: "json_object" },
      messages,
    });
  }

  let completion;
  try {
    completion = await callModel(REASONING_MODEL);
  } catch {
    try {
      completion = await callModel(REASONING_FALLBACK);
    } catch {
      return FALLBACK_ANALYSIS;
    }
  }

  try {
    const text = completion.choices[0]?.message?.content;
    if (!text) return FALLBACK_ANALYSIS;
    const parsed = JSON.parse(text) as Partial<ConditionAnalysis>;

    const core = Array.isArray(parsed.coreSpecialtyTerms)
      ? parsed.coreSpecialtyTerms.map((t) => String(t).toLowerCase()).filter(Boolean)
      : [];
    const fallback = Array.isArray(parsed.fallbackSpecialtyTerms)
      ? parsed.fallbackSpecialtyTerms.map((t) => String(t).toLowerCase()).filter(Boolean)
      : [];

    return {
      condition: parsed.condition || "general consultation",
      ageGroup: (parsed.ageGroup as ConditionAnalysis["ageGroup"]) || "any",
      urgency: (parsed.urgency as ConditionAnalysis["urgency"]) || "medium",
      coreSpecialtyTerms: core.length > 0 ? core : ["general"],
      fallbackSpecialtyTerms: fallback,
      specialtyLabels:
        Array.isArray(parsed.specialtyLabels) && parsed.specialtyLabels.length > 0
          ? parsed.specialtyLabels
          : ["General Medicine"],
      excludeKeywords: Array.isArray(parsed.excludeKeywords)
        ? parsed.excludeKeywords.map((t) => String(t).toLowerCase())
        : [],
      preferredFacilityTypes:
        Array.isArray(parsed.preferredFacilityTypes) && parsed.preferredFacilityTypes.length > 0
          ? parsed.preferredFacilityTypes
          : ["Hospital"],
      maxReasonableDistanceKm:
        typeof parsed.maxReasonableDistanceKm === "number" && parsed.maxReasonableDistanceKm > 0
          ? Math.min(parsed.maxReasonableDistanceKm, 500)
          : 50,
      state: parsed.state ?? null,
      district: parsed.district ?? null,
      pincode: parsed.pincode ?? null,
      rationale: parsed.rationale || FALLBACK_ANALYSIS.rationale,
    };
  } catch {
    return FALLBACK_ANALYSIS;
  }
}

async function generateFollowups(
  query: string,
  recommendation: AgentRecommendation | null,
  analysis: ConditionAnalysis,
  history: HistoryEntry[],
): Promise<string[]> {
  const client = getOpenAI();
  if (!client) return [];

  try {
    const context = recommendation
      ? `Recommendation: ${recommendation.name} (${recommendation.type ?? "facility"}) in ${recommendation.district ?? recommendation.state}, ${Math.round(recommendation.trustMin * 100)}% trust.`
      : "No recommendation produced.";

    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: FOLLOWUP_PROMPT },
    ];
    for (const entry of history.slice(-4)) {
      messages.push(entry);
    }
    messages.push({
      role: "user",
      content: `Original query: "${query}"\nCondition: ${analysis.condition}\nUrgency: ${analysis.urgency}\n${context}\n\nGenerate 3 follow-up question chips.`,
    });

    const completion = await client.chat.completions.create({
      model: FOLLOWUP_MODEL,
      response_format: { type: "json_object" },
      messages,
    });
    const text = completion.choices[0]?.message?.content;
    if (!text) return [];
    const parsed = JSON.parse(text) as { questions?: unknown };
    if (!Array.isArray(parsed.questions)) return [];
    return parsed.questions
      .filter((q): q is string => typeof q === "string" && q.length > 0 && q.length < 80)
      .slice(0, 3);
  } catch {
    return [];
  }
}

type ValidatorVerdict = {
  appropriate: boolean;
  confidence: "high" | "medium" | "low";
  reasoning: string;
  redFlags: string[];
  betterMatchHint: string | null;
};

type CandidateForValidator = {
  id: number;
  name: string;
  type: string | null;
  district: string | null;
  state: string | null;
  services: string[] | null;
  specialties: string[] | null;
  rawNotes: string | null;
};

async function verifyCandidate(
  query: string,
  analysis: ConditionAnalysis,
  candidate: CandidateForValidator,
): Promise<ValidatorVerdict | null> {
  const client = getOpenAI();
  if (!client) return null;

  const candidateBlock = [
    `Facility name: ${candidate.name}`,
    `Type: ${candidate.type ?? "unknown"}`,
    `Location: ${candidate.district ?? "unknown"}, ${candidate.state ?? "unknown"}`,
    `Specialties: ${
      Array.isArray(candidate.specialties) ? candidate.specialties.join(", ") : "(none)"
    }`,
    `Services: ${
      Array.isArray(candidate.services) ? candidate.services.slice(0, 25).join("; ") : "(none)"
    }`,
    `Raw notes: ${candidate.rawNotes?.slice(0, 1500) ?? "(empty)"}`,
  ].join("\n");

  const userBlock = [
    `User query: "${query}"`,
    `Identified condition: ${analysis.condition}`,
    `Age group: ${analysis.ageGroup}`,
    `Urgency: ${analysis.urgency}`,
    `Specialty needed: ${analysis.specialtyLabels.join(" or ")}`,
    "",
    "Candidate facility:",
    candidateBlock,
    "",
    "Decide whether this facility is appropriate for the user's condition. Return JSON.",
  ].join("\n");

  async function callModel(model: string) {
    return client!.chat.completions.create({
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: VALIDATOR_PROMPT },
        { role: "user", content: userBlock },
      ],
    });
  }

  let completion;
  try {
    completion = await callModel(VALIDATOR_MODEL);
  } catch {
    try {
      completion = await callModel(REASONING_FALLBACK);
    } catch {
      return null;
    }
  }

  try {
    const text = completion.choices[0]?.message?.content;
    if (!text) return null;
    const parsed = JSON.parse(text) as Partial<ValidatorVerdict>;
    return {
      appropriate: parsed.appropriate === true,
      confidence:
        parsed.confidence === "high" || parsed.confidence === "medium" || parsed.confidence === "low"
          ? parsed.confidence
          : "low",
      reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : "",
      redFlags: Array.isArray(parsed.redFlags)
        ? parsed.redFlags.filter((f): f is string => typeof f === "string")
        : [],
      betterMatchHint:
        typeof parsed.betterMatchHint === "string" ? parsed.betterMatchHint : null,
    };
  } catch {
    return null;
  }
}

async function refineAnalysis(
  query: string,
  history: HistoryEntry[],
  currentAnalysis: ConditionAnalysis,
  rejectedSummaries: string[],
  rejectedHints: string[],
): Promise<ConditionAnalysis | null> {
  const client = getOpenAI();
  if (!client) return null;

  const userBlock = [
    `Original user query: "${query}"`,
    "",
    "Previous analysis the search engine used:",
    JSON.stringify(
      {
        condition: currentAnalysis.condition,
        ageGroup: currentAnalysis.ageGroup,
        urgency: currentAnalysis.urgency,
        coreSpecialtyTerms: currentAnalysis.coreSpecialtyTerms,
        fallbackSpecialtyTerms: currentAnalysis.fallbackSpecialtyTerms,
        specialtyLabels: currentAnalysis.specialtyLabels,
        excludeKeywords: currentAnalysis.excludeKeywords,
        preferredFacilityTypes: currentAnalysis.preferredFacilityTypes,
        maxReasonableDistanceKm: currentAnalysis.maxReasonableDistanceKm,
        state: currentAnalysis.state,
        district: currentAnalysis.district,
        pincode: currentAnalysis.pincode,
      },
      null,
      2,
    ),
    "",
    "Validator rejected the top candidates with these reasons:",
    rejectedSummaries.map((r, i) => `${i + 1}. ${r}`).join("\n"),
    "",
    rejectedHints.length > 0
      ? `Validator hints for better matches:\n${rejectedHints.map((h, i) => `${i + 1}. ${h}`).join("\n")}`
      : "Validator did not suggest a specific alternative facility type.",
    "",
    "Refine the analysis. Return JSON.",
  ].join("\n");

  async function callModel(model: string) {
    return client!.chat.completions.create({
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: REFINE_PROMPT },
        ...history.slice(-4).map((entry) => ({
          role: entry.role,
          content: entry.content,
        })),
        { role: "user", content: userBlock },
      ],
    });
  }

  let completion;
  try {
    completion = await callModel(REFINE_MODEL);
  } catch {
    try {
      completion = await callModel(REASONING_FALLBACK);
    } catch {
      return null;
    }
  }

  try {
    const text = completion.choices[0]?.message?.content;
    if (!text) return null;
    const parsed = JSON.parse(text) as Partial<ConditionAnalysis>;

    const core = Array.isArray(parsed.coreSpecialtyTerms)
      ? parsed.coreSpecialtyTerms.map((t) => String(t).toLowerCase()).filter(Boolean)
      : currentAnalysis.coreSpecialtyTerms;
    const fallback = Array.isArray(parsed.fallbackSpecialtyTerms)
      ? parsed.fallbackSpecialtyTerms.map((t) => String(t).toLowerCase()).filter(Boolean)
      : currentAnalysis.fallbackSpecialtyTerms;

    return {
      condition: parsed.condition || currentAnalysis.condition,
      ageGroup: (parsed.ageGroup as ConditionAnalysis["ageGroup"]) || currentAnalysis.ageGroup,
      urgency: (parsed.urgency as ConditionAnalysis["urgency"]) || currentAnalysis.urgency,
      coreSpecialtyTerms: core.length > 0 ? core : currentAnalysis.coreSpecialtyTerms,
      fallbackSpecialtyTerms: fallback,
      specialtyLabels:
        Array.isArray(parsed.specialtyLabels) && parsed.specialtyLabels.length > 0
          ? parsed.specialtyLabels
          : currentAnalysis.specialtyLabels,
      excludeKeywords: Array.isArray(parsed.excludeKeywords)
        ? parsed.excludeKeywords.map((t) => String(t).toLowerCase())
        : currentAnalysis.excludeKeywords,
      preferredFacilityTypes:
        Array.isArray(parsed.preferredFacilityTypes) && parsed.preferredFacilityTypes.length > 0
          ? parsed.preferredFacilityTypes
          : currentAnalysis.preferredFacilityTypes,
      maxReasonableDistanceKm:
        typeof parsed.maxReasonableDistanceKm === "number" && parsed.maxReasonableDistanceKm > 0
          ? Math.min(parsed.maxReasonableDistanceKm, 500)
          : currentAnalysis.maxReasonableDistanceKm,
      state: parsed.state ?? currentAnalysis.state,
      district: parsed.district ?? currentAnalysis.district,
      pincode: parsed.pincode ?? currentAnalysis.pincode,
      rationale:
        parsed.rationale ||
        `Refined search based on validator feedback: ${rejectedHints[0] ?? "broaden specialty"}.`,
    };
  } catch {
    return null;
  }
}

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export type AgentEmit = (event: string, payload: unknown) => void;

async function searchFacilities(
  resolvedState: string | null,
  specialtyTerms: string[],
) {
  const conditions = [isNotNull(facilities.lat), isNotNull(facilities.lon)];
  if (resolvedState) {
    conditions.push(ilike(facilities.state, `%${resolvedState}%`));
  }
  if (specialtyTerms.length > 0) {
    const clauses = specialtyTerms.flatMap((term) => [
      sql`${facilities.specialties}::text ILIKE ${"%" + term + "%"}`,
      sql`${facilities.services}::text ILIKE ${"%" + term + "%"}`,
      ilike(facilities.facilityType, `%${term}%`),
    ]);
    const combined = or(...clauses);
    if (combined) conditions.push(combined);
  }

  return db
    .select({
      id: facilities.id,
      name: facilities.facilityName,
      type: facilities.facilityType,
      state: facilities.state,
      district: facilities.district,
      lat: facilities.lat,
      lon: facilities.lon,
      trustMin: facilities.trustMin,
      services: facilities.services,
      specialties: facilities.specialties,
    })
    .from(facilities)
    .where(and(...conditions))
    .limit(500);
}

async function searchByStateOnly(resolvedState: string) {
  return db
    .select({
      id: facilities.id,
      name: facilities.facilityName,
      type: facilities.facilityType,
      state: facilities.state,
      district: facilities.district,
      lat: facilities.lat,
      lon: facilities.lon,
      trustMin: facilities.trustMin,
      services: facilities.services,
      specialties: facilities.specialties,
    })
    .from(facilities)
    .where(
      and(
        isNotNull(facilities.lat),
        isNotNull(facilities.lon),
        ilike(facilities.state, `%${resolvedState}%`),
      ),
    )
    .limit(500);
}

export async function streamAgent(
  query: string,
  history: HistoryEntry[],
  emit: AgentEmit,
): Promise<void> {
  emit("query", { query });

  emit("reasoning", {
    step: "identify",
    text: `Reading your query and understanding the medical context.`,
  });

  const analysis = await analyzeCondition(query, history);

  emit("reasoning", {
    step: "diagnose",
    text: `Condition: ${analysis.condition}${analysis.ageGroup !== "any" ? ` (${analysis.ageGroup})` : ""}. Primary specialist: ${analysis.specialtyLabels.join(" or ")}. Urgency: ${analysis.urgency}.`,
  });

  emit("reasoning", {
    step: "research",
    text: analysis.rationale,
  });

  const pincode = analysis.pincode || extractPincode(query);
  const pincodeLoc = lookupPincode(pincode);
  const cityMatch = extractCityCoords(query);
  let historyCityMatch = cityMatch;

  if (!historyCityMatch) {
    for (let i = history.length - 1; i >= 0; i--) {
      const match = extractCityCoords(history[i].content);
      if (match) {
        historyCityMatch = match;
        break;
      }
    }
  }

  const geoTarget = analysis.district ?? analysis.state ?? null;
  if (!pincodeLoc && !historyCityMatch && geoTarget) {
    const geocoded = await geocodeLocation(geoTarget);
    if (geocoded) {
      historyCityMatch = geocoded;
      emit("reasoning", { step: "locate", text: `Geocoded "${geoTarget}" → ${geocoded.name}, ${geocoded.state} (${geocoded.lat.toFixed(2)}°N, ${geocoded.lon.toFixed(2)}°E).` });
    }
  }

  const resolvedState = pincodeLoc?.state ?? analysis.state ?? historyCityMatch?.state ?? null;
  let resolvedDistrict = pincodeLoc?.district ?? analysis.district ?? historyCityMatch?.name ?? null;
  const centerLat = pincodeLoc?.lat ?? historyCityMatch?.lat ?? null;
  const centerLon = pincodeLoc?.lon ?? historyCityMatch?.lon ?? null;
  const avoidCities = extractAvoidLocations(query);

  if (resolvedDistrict) {
    resolvedDistrict = resolvedDistrict.charAt(0).toUpperCase() + resolvedDistrict.slice(1);
  }

  emit("reasoning", {
    step: "locate",
    text: `Location: ${resolvedDistrict ?? "any district"}, ${resolvedState ?? "any state"}${pincode ? ` (pincode ${pincode})` : ""}. Reasonable travel: ${analysis.maxReasonableDistanceKm} km.${avoidCities.length > 0 ? ` Avoiding: ${avoidCities.join(", ")}.` : ""}`,
  });

  type Scored = {
    id: number;
    name: string;
    type: string | null;
    state: string | null;
    district: string | null;
    lat: number | null;
    lon: number | null;
    trustMin: number | null;
    services: string[] | null;
    specialties: string[] | null;
    distance: number;
    score: number;
    typeBoost: number;
  };

  type AttemptResult = {
    candidates: Scored[];
    radius: number;
    droppedCount: number;
    rowCount: number;
    withinLimitCount: number;
  };

  const runSearchAndScore = async (
    currentAnalysis: ConditionAnalysis,
  ): Promise<AttemptResult> => {
    let rows = await searchFacilities(resolvedState, currentAnalysis.coreSpecialtyTerms);

    if (rows.length === 0 && currentAnalysis.fallbackSpecialtyTerms.length > 0) {
      emit("reasoning", {
        step: "search",
        text: `No matches for primary specialty ${currentAnalysis.specialtyLabels[0]}. Expanding to related specialties: ${currentAnalysis.fallbackSpecialtyTerms.join(", ")}.`,
      });
      rows = await searchFacilities(
        resolvedState,
        [...currentAnalysis.coreSpecialtyTerms, ...currentAnalysis.fallbackSpecialtyTerms],
      );
    } else {
      emit("reasoning", {
        step: "search",
        text: `Searched database — ${rows.length} candidates matching ${currentAnalysis.specialtyLabels.join("/")}.`,
      });
    }

    if (rows.length === 0 && resolvedState) {
      emit("reasoning", {
        step: "search",
        text: `No specialty matches in ${resolvedState}. Broadening to all facilities in the state.`,
      });
      rows = await searchByStateOnly(resolvedState);
    }

    const filtered = rows.filter((r) => {
      if (r.lat === null || r.lon === null) return false;
      if (avoidCities.length > 0) {
        const district = (r.district ?? "").toLowerCase();
        if (avoidCities.some((c) => district.includes(c))) return false;
      }
      return true;
    });

    const excludeMatch = (r: (typeof filtered)[number]): boolean => {
      if (currentAnalysis.excludeKeywords.length === 0) return false;
      const haystack = [
        r.name,
        r.type ?? "",
        Array.isArray(r.services) ? r.services.join(" ") : "",
        Array.isArray(r.specialties) ? r.specialties.join(" ") : "",
      ]
        .join(" ")
        .toLowerCase();
      return currentAnalysis.excludeKeywords.some((kw) => haystack.includes(kw));
    };

    const cleanCandidates = filtered.filter((r) => !excludeMatch(r));
    const droppedCount = filtered.length - cleanCandidates.length;
    if (droppedCount > 0) {
      emit("reasoning", {
        step: "filter",
        text: `Filtered out ${droppedCount} facilities matching exclusion keywords (${currentAnalysis.excludeKeywords.join(", ")}) — wrong specialty for this condition.`,
      });
    }

    const workingSet = cleanCandidates.length > 0 ? cleanCandidates : filtered;
    const preferredTypeLowercase = currentAnalysis.preferredFacilityTypes.map((t) => t.toLowerCase());

    const scored: Scored[] = workingSet
      .map((r) => {
        const distance =
          centerLat !== null && centerLon !== null
            ? distanceKm(centerLat, centerLon, r.lat as number, r.lon as number)
            : 0;
        const trust = r.trustMin ?? 0;
        const distancePenalty =
          centerLat !== null
            ? distance > currentAnalysis.maxReasonableDistanceKm
              ? 200 + distance
              : (distance / currentAnalysis.maxReasonableDistanceKm) * 50
            : 0;
        const trustBonus = trust * 100;
        const facilityType = (r.type ?? "").toLowerCase();
        const typeBoost = preferredTypeLowercase.some((t) => facilityType.includes(t)) ? 15 : 0;
        const score = trustBonus + typeBoost - distancePenalty;
        return {
          id: r.id,
          name: r.name,
          type: r.type ?? null,
          state: r.state ?? null,
          district: r.district ?? null,
          lat: r.lat ?? null,
          lon: r.lon ?? null,
          trustMin: r.trustMin ?? null,
          services: r.services ?? null,
          specialties: r.specialties ?? null,
          distance,
          score,
          typeBoost,
        };
      })
      .sort((a, b) => b.score - a.score);

    let radius = currentAnalysis.maxReasonableDistanceKm;
    let withinLimit = scored.filter((s) => centerLat === null || s.distance <= radius);

    if (centerLat !== null && withinLimit.length === 0) {
      const expansionTiers = [radius * 1.5, radius * 2.5, radius * 4];
      for (const newRadius of expansionTiers) {
        emit("reasoning", {
          step: "expand",
          text: `Nothing found within ${Math.round(radius)} km. Expanding search to ${Math.round(newRadius)} km radius…`,
        });
        radius = newRadius;
        withinLimit = scored.filter((s) => s.distance <= radius);
        if (withinLimit.length > 0) {
          emit("reasoning", {
            step: "expand",
            text: `Found ${withinLimit.length} facilities within ${Math.round(radius)} km after expansion.`,
          });
          break;
        }
      }
    }

    if (centerLat !== null) {
      emit("reasoning", {
        step: "score",
        text: `${withinLimit.length} within ${Math.round(radius)} km. Scoring by trust, distance, and facility type fit.`,
      });
    }

    return {
      candidates: withinLimit.length > 0 ? withinLimit : scored,
      radius,
      droppedCount,
      rowCount: rows.length,
      withinLimitCount: withinLimit.length,
    };
  };

  let effectiveAnalysis = analysis;
  let verifiedBest: Scored | null = null;
  let verifiedVerdict: ValidatorVerdict | null = null;
  let lastAttemptResult: AttemptResult | null = null;
  let lastRejectedVerdicts: { cand: Scored; verdict: ValidatorVerdict }[] = [];
  let lastRejectedHints: string[] = [];
  const allWarnings: AgentWarning[] = [];

  for (let attempt = 1; attempt <= 3; attempt++) {
    if (attempt > 1) {
      emit("reasoning", {
        step: "refine",
        text: `Attempt ${attempt} of 3 — refining search criteria from validator feedback.`,
      });
      const refined = await refineAnalysis(
        query,
        history,
        effectiveAnalysis,
        lastRejectedVerdicts.map((rv) => `${rv.cand.name}: ${rv.verdict.reasoning}`),
        lastRejectedHints,
      );
      if (!refined) {
        emit("reasoning", {
          step: "refine",
          text: "Could not refine analysis. Falling back to previous best candidate.",
        });
        break;
      }
      effectiveAnalysis = refined;
      emit("reasoning", {
        step: "refine",
        text: `New plan: specialty=${refined.specialtyLabels.join("/")}, exclude=${refined.excludeKeywords.length} terms, radius=${refined.maxReasonableDistanceKm}km. ${refined.rationale}`,
      });
    } else {
      emit("reasoning", {
        step: "search",
        text: `Attempt 1 of 3 — searching with primary specialty ${effectiveAnalysis.specialtyLabels.join("/")}.`,
      });
    }

    const result = await runSearchAndScore(effectiveAnalysis);
    lastAttemptResult = result;

    if (result.candidates.length === 0) {
      emit("reasoning", {
        step: "warning",
        text: "No candidates passed scoring. Trying refinement.",
      });
      lastRejectedVerdicts = [];
      lastRejectedHints = [];
      continue;
    }

    const lowTrust = result.candidates.filter((r) => (r.trustMin ?? 0) < 0.4).slice(0, 3);
    if (attempt === 1 && lowTrust.length > 0) {
      const lowTrustWarnings: AgentWarning[] = lowTrust.map((r) => ({
        facilityId: r.id,
        name: r.name,
        lat: r.lat ?? undefined,
        lon: r.lon ?? undefined,
        trustMin: r.trustMin ?? 0,
        reason: `Low trust score (${Math.round((r.trustMin ?? 0) * 100)}%) — verify before using.`,
      }));
      allWarnings.push(...lowTrustWarnings);
      emit("reasoning", {
        step: "warning",
        text: `Flagged ${lowTrust.length} low-trust facilities to avoid.`,
      });
    }

    emit("reasoning", {
      step: "verify",
      text: `Running second-opinion verifier on top ${Math.min(3, result.candidates.length)} candidates — reading raw notes against the user's actual condition.`,
    });

    const rejectedThisAttempt: { cand: Scored; verdict: ValidatorVerdict }[] = [];
    const hintsThisAttempt: string[] = [];
    let approvedThisAttempt: { cand: Scored; verdict: ValidatorVerdict | null } | null = null;

    for (const cand of result.candidates.slice(0, 3)) {
      const candFull = await db
        .select({
          id: facilities.id,
          services: facilities.services,
          specialties: facilities.specialties,
          rawNotes: facilities.rawNotes,
        })
        .from(facilities)
        .where(eq(facilities.id, cand.id))
        .limit(1);

      const fullData = candFull[0];
      const verdict = await verifyCandidate(query, effectiveAnalysis, {
        id: cand.id,
        name: cand.name,
        type: cand.type,
        district: cand.district,
        state: cand.state,
        services: fullData?.services ?? cand.services,
        specialties: fullData?.specialties ?? cand.specialties,
        rawNotes: fullData?.rawNotes ?? null,
      });

      if (!verdict) {
        approvedThisAttempt = { cand, verdict: null };
        break;
      }
      if (verdict.appropriate) {
        emit("reasoning", {
          step: "verify",
          text: `Verifier approved ${cand.name}: ${verdict.reasoning}`,
        });
        approvedThisAttempt = { cand, verdict };
        break;
      }
      const flagsLabel = verdict.redFlags.length > 0 ? ` [${verdict.redFlags.join(", ")}]` : "";
      emit("reasoning", {
        step: "warning",
        text: `Verifier rejected ${cand.name}${flagsLabel}: ${verdict.reasoning}`,
      });
      rejectedThisAttempt.push({ cand, verdict });
      if (verdict.betterMatchHint && !hintsThisAttempt.includes(verdict.betterMatchHint)) {
        hintsThisAttempt.push(verdict.betterMatchHint);
      }
    }

    if (approvedThisAttempt) {
      verifiedBest = approvedThisAttempt.cand;
      verifiedVerdict = approvedThisAttempt.verdict;
      break;
    }

    lastRejectedVerdicts = rejectedThisAttempt;
    lastRejectedHints = hintsThisAttempt;

    if (attempt === 3) {
      emit("reasoning", {
        step: "verify",
        text: `All 3 attempts exhausted (${rejectedThisAttempt.length} candidates rejected this round). Falling back to best available with explicit warnings — do not treat as a verified match.`,
      });
    }
  }

  if (!verifiedBest && lastRejectedVerdicts.length > 0) {
    const fallback = lastRejectedVerdicts[0];
    verifiedBest = fallback.cand;
    verifiedVerdict = fallback.verdict;
    allWarnings.push({
      facilityId: fallback.cand.id,
      name: fallback.cand.name,
      lat: fallback.cand.lat ?? undefined,
      lon: fallback.cand.lon ?? undefined,
      trustMin: fallback.cand.trustMin ?? 0,
      reason: `Verifier flagged after ${3} refinement attempts: ${fallback.verdict.reasoning}${
        lastRejectedHints.length > 0 ? ` Suggested alternative: ${lastRejectedHints[0]}.` : ""
      }`,
    });
  }

  if (!verifiedBest && lastAttemptResult && lastAttemptResult.candidates.length > 0) {
    verifiedBest = lastAttemptResult.candidates[0];
  }

  if (!verifiedBest) {
    emit("reasoning", {
      step: "error",
      text: "No facilities found across all 3 attempts. Try mentioning a specific city, pincode, or state.",
    });
    emit("done", {});
    return;
  }

  if (allWarnings.length > 0) {
    emit("warnings", allWarnings);
  }

  const candidates = lastAttemptResult?.candidates ?? [];
  const radius = lastAttemptResult?.radius ?? effectiveAnalysis.maxReasonableDistanceKm;

  if (
    centerLat !== null &&
    radius > effectiveAnalysis.maxReasonableDistanceKm &&
    verifiedBest.distance > effectiveAnalysis.maxReasonableDistanceKm
  ) {
    emit("reasoning", {
      step: "warning",
      text: `Best match is ${Math.round(verifiedBest.distance)} km away — beyond the ideal ${effectiveAnalysis.maxReasonableDistanceKm} km for this condition. Consider whether travel is practical.`,
    });
  }

  const final = verifiedBest;
  const warnings = allWarnings;

  emit("reasoning", {
    step: "recommend",
    text:
      centerLat !== null
        ? `Best match: ${final.name} (${final.type ?? "facility"}) in ${final.district ?? final.state} — ${Math.round(final.distance)} km away, ${Math.round((final.trustMin ?? 0) * 100)}% trust.`
        : `Best match: ${final.name} in ${final.district ?? final.state} with ${Math.round((final.trustMin ?? 0) * 100)}% trust.`,
  });

  const verifierReasonSuffix = verifiedVerdict?.reasoning
    ? ` Verifier (${verifiedVerdict.confidence}): ${verifiedVerdict.reasoning}`
    : "";

  const recommendation: AgentRecommendation = {
    facilityId: final.id,
    name: final.name,
    type: final.type ?? undefined,
    district: final.district ?? undefined,
    state: final.state ?? undefined,
    lat: final.lat as number,
    lon: final.lon as number,
    trustMin: final.trustMin ?? 0,
    reason:
      centerLat !== null
        ? `${Math.round(final.distance)} km from you with ${Math.round((final.trustMin ?? 0) * 100)}% trust. Suitable for ${effectiveAnalysis.condition}.${verifierReasonSuffix}`
        : `Highest trust facility for ${effectiveAnalysis.specialtyLabels[0]} in ${final.state}.${verifierReasonSuffix}`,
  };
  emit("recommendation", recommendation);

  const alternativeRows = candidates
    .filter((r) => r.id !== final.id)
    .slice(0, 3);
  if (alternativeRows.length > 0) {
    emit("reasoning", {
      step: "alternatives",
      text: `Other options: ${alternativeRows.map((a) => `${a.name} (${a.district ?? a.state}, ${Math.round(a.distance)} km)`).join("; ")}.`,
    });
  }

  emit("mapState", {
    center: [recommendation.lon, recommendation.lat],
    zoom: 12,
    highlightGreen: [recommendation.facilityId],
    highlightRed: warnings.map((w) => w.facilityId),
  });

  const followups = await generateFollowups(query, recommendation, effectiveAnalysis, history);
  if (followups.length > 0) {
    emit("followup", { questions: followups });
  }

  emit("done", {});
}

export async function runAgent(
  query: string,
  history: HistoryEntry[] = [],
): Promise<AgentResponse> {
  const reasoning: AgentReasoningStep[] = [];
  let recommendation: AgentRecommendation | null = null;
  let warnings: AgentWarning[] = [];
  let mapState: AgentResponse["mapState"] = null;

  await streamAgent(query, history, (event, payload) => {
    if (event === "reasoning") {
      reasoning.push(payload as AgentReasoningStep);
    } else if (event === "recommendation") {
      recommendation = payload as AgentRecommendation;
    } else if (event === "warnings") {
      warnings = payload as AgentWarning[];
    } else if (event === "mapState") {
      mapState = payload as AgentResponse["mapState"];
    }
  });

  return {
    query,
    recommendation,
    reasoning,
    warnings,
    mapState,
  };
}
