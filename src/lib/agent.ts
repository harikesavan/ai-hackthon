import OpenAI from "openai";
import { db } from "@/lib/db";
import { facilities } from "@/lib/db/schema";
import { and, ilike, isNotNull, or, sql } from "drizzle-orm";
import {
  SYSTEM_PROMPT,
  FOLLOWUP_PROMPT,
  REASONING_MODEL,
  REASONING_FALLBACK,
  FOLLOWUP_MODEL,
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

  const resolvedState = pincodeLoc?.state ?? analysis.state ?? cityMatch?.state ?? null;
  let resolvedDistrict = pincodeLoc?.district ?? analysis.district ?? cityMatch?.name ?? null;
  const centerLat = pincodeLoc?.lat ?? cityMatch?.lat ?? null;
  const centerLon = pincodeLoc?.lon ?? cityMatch?.lon ?? null;
  const avoidCities = extractAvoidLocations(query);

  if (resolvedDistrict) {
    resolvedDistrict = resolvedDistrict.charAt(0).toUpperCase() + resolvedDistrict.slice(1);
  }

  emit("reasoning", {
    step: "locate",
    text: `Location: ${resolvedDistrict ?? "any district"}, ${resolvedState ?? "any state"}${pincode ? ` (pincode ${pincode})` : ""}. Reasonable travel: ${analysis.maxReasonableDistanceKm} km.${avoidCities.length > 0 ? ` Avoiding: ${avoidCities.join(", ")}.` : ""}`,
  });

  let rows = await searchFacilities(resolvedState, analysis.coreSpecialtyTerms);

  if (rows.length === 0 && analysis.fallbackSpecialtyTerms.length > 0) {
    emit("reasoning", {
      step: "search",
      text: `No matches for primary specialty ${analysis.specialtyLabels[0]}. Expanding to related specialties: ${analysis.fallbackSpecialtyTerms.join(", ")}.`,
    });
    rows = await searchFacilities(
      resolvedState,
      [...analysis.coreSpecialtyTerms, ...analysis.fallbackSpecialtyTerms],
    );
  } else {
    emit("reasoning", {
      step: "search",
      text: `Searched database — ${rows.length} candidates matching ${analysis.specialtyLabels.join("/")}.`,
    });
  }

  if (rows.length === 0 && resolvedState) {
    emit("reasoning", {
      step: "search",
      text: `No specialty matches in ${resolvedState}. Broadening to all facilities in the state.`,
    });
    rows = await searchByStateOnly(resolvedState);
  }

  if (rows.length === 0) {
    emit("reasoning", {
      step: "warning",
      text: "No facilities found. Try mentioning a specific city, pincode, or state.",
    });
    emit("done", {});
    return;
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
    if (analysis.excludeKeywords.length === 0) return false;
    const haystack = [
      r.name,
      r.type ?? "",
      Array.isArray(r.services) ? r.services.join(" ") : "",
      Array.isArray(r.specialties) ? r.specialties.join(" ") : "",
    ]
      .join(" ")
      .toLowerCase();
    return analysis.excludeKeywords.some((kw) => haystack.includes(kw));
  };

  const cleanCandidates = filtered.filter((r) => !excludeMatch(r));
  const droppedCount = filtered.length - cleanCandidates.length;
  if (droppedCount > 0) {
    emit("reasoning", {
      step: "filter",
      text: `Filtered out ${droppedCount} facilities matching exclusion keywords (${analysis.excludeKeywords.join(", ")}) — wrong specialty for this condition.`,
    });
  }

  const workingSet = cleanCandidates.length > 0 ? cleanCandidates : filtered;

  type Scored = (typeof workingSet)[number] & {
    distance: number;
    score: number;
    typeBoost: number;
  };

  const preferredTypeLowercase = analysis.preferredFacilityTypes.map((t) => t.toLowerCase());

  const scored: Scored[] = workingSet
    .map((r) => {
      const distance =
        centerLat !== null && centerLon !== null
          ? distanceKm(centerLat, centerLon, r.lat as number, r.lon as number)
          : 0;
      const trust = r.trustMin ?? 0;
      const distancePenalty =
        centerLat !== null
          ? distance > analysis.maxReasonableDistanceKm
            ? 200 + distance
            : (distance / analysis.maxReasonableDistanceKm) * 50
          : 0;
      const trustBonus = trust * 100;
      const facilityType = (r.type ?? "").toLowerCase();
      const typeBoost = preferredTypeLowercase.some((t) => facilityType.includes(t)) ? 15 : 0;
      const score = trustBonus + typeBoost - distancePenalty;
      return { ...r, distance, score, typeBoost };
    })
    .sort((a, b) => b.score - a.score);

  let radius = analysis.maxReasonableDistanceKm;
  let withinLimit = scored.filter(
    (s) => centerLat === null || s.distance <= radius,
  );

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

  const candidates = withinLimit.length > 0 ? withinLimit : scored;
  const best = candidates[0];

  if (!best) {
    emit("done", {});
    return;
  }

  if (withinLimit.length === 0 && centerLat !== null) {
    emit("reasoning", {
      step: "warning",
      text: `No facility found near you even after expanding search. Closest match is ${Math.round(best.distance)} km away — consider asking for a different location.`,
    });
  } else if (
    centerLat !== null &&
    radius > analysis.maxReasonableDistanceKm &&
    best.distance > analysis.maxReasonableDistanceKm
  ) {
    emit("reasoning", {
      step: "warning",
      text: `Best match is ${Math.round(best.distance)} km away — beyond the ideal ${analysis.maxReasonableDistanceKm} km for this condition. Consider whether travel is practical.`,
    });
  }

  const lowTrust = candidates.filter((r) => (r.trustMin ?? 0) < 0.4).slice(0, 3);
  const warnings: AgentWarning[] = lowTrust.map((r) => ({
    facilityId: r.id,
    name: r.name,
    lat: r.lat ?? undefined,
    lon: r.lon ?? undefined,
    trustMin: r.trustMin ?? 0,
    reason: `Low trust score (${Math.round((r.trustMin ?? 0) * 100)}%) — verify before using.`,
  }));

  if (warnings.length > 0) {
    emit("reasoning", {
      step: "warning",
      text: `Flagged ${warnings.length} low-trust facilities to avoid.`,
    });
    emit("warnings", warnings);
  }

  emit("reasoning", {
    step: "recommend",
    text:
      centerLat !== null
        ? `Best match: ${best.name} (${best.type ?? "facility"}) in ${best.district ?? best.state} — ${Math.round(best.distance)} km away, ${Math.round((best.trustMin ?? 0) * 100)}% trust.`
        : `Best match: ${best.name} in ${best.district ?? best.state} with ${Math.round((best.trustMin ?? 0) * 100)}% trust.`,
  });

  const recommendation: AgentRecommendation = {
    facilityId: best.id,
    name: best.name,
    type: best.type ?? undefined,
    district: best.district ?? undefined,
    state: best.state ?? undefined,
    lat: best.lat as number,
    lon: best.lon as number,
    trustMin: best.trustMin ?? 0,
    reason:
      centerLat !== null
        ? `${Math.round(best.distance)} km from you with ${Math.round((best.trustMin ?? 0) * 100)}% trust. Suitable for ${analysis.condition}.`
        : `Highest trust facility for ${analysis.specialtyLabels[0]} in ${best.state}.`,
  };
  emit("recommendation", recommendation);

  const alternativeRows = candidates.slice(1, 4).filter((r) => r.id !== best.id);
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

  const followups = await generateFollowups(query, recommendation, analysis, history);
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
