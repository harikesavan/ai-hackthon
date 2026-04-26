import { db } from "@/lib/db";
import { facilities } from "@/lib/db/schema";
import { isNotNull } from "drizzle-orm";

type CachedPayload = {
  json: string;
  builtAt: number;
};

let cached: CachedPayload | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function GET() {
  const now = Date.now();
  if (cached && now - cached.builtAt < CACHE_TTL_MS) {
    return new Response(cached.json, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
      },
    });
  }

  const rows = await db
    .select({
      id: facilities.id,
      name: facilities.facilityName,
      state: facilities.state,
      district: facilities.district,
      lat: facilities.lat,
      lon: facilities.lon,
      beds: facilities.beds,
      services: facilities.services,
      emergencyAvailable: facilities.emergencyAvailable,
      trustMin: facilities.trustMin,
      reviewStatus: facilities.reviewStatus,
    })
    .from(facilities)
    .where(isNotNull(facilities.lat));

  const geojson = {
    type: "FeatureCollection" as const,
    features: rows.map((row) => ({
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        coordinates: [row.lon, row.lat],
      },
      properties: {
        id: row.id,
        name: row.name,
        state: row.state,
        district: row.district,
        beds: row.beds,
        services: row.services,
        emergencyAvailable: row.emergencyAvailable,
        trustMin: row.trustMin,
        reviewStatus: row.reviewStatus,
      },
    })),
  };

  const json = JSON.stringify(geojson);
  cached = { json, builtAt: now };

  return new Response(json, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
    },
  });
}
