import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { facilities } from "@/lib/db/schema";
import { isNotNull } from "drizzle-orm";

export async function GET() {
  const rows = await db
    .select({
      id: facilities.id,
      name: facilities.facilityName,
      type: facilities.facilityType,
      state: facilities.state,
      district: facilities.district,
      lat: facilities.lat,
      lon: facilities.lon,
      beds: facilities.beds,
      services: facilities.services,
      emergencyAvailable: facilities.emergencyAvailable,
      extractionConfidence: facilities.extractionConfidence,
      ruleViolations: facilities.ruleViolations,
      peerAnomalyPercentile: facilities.peerAnomalyPercentile,
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
        type: row.type,
        state: row.state,
        district: row.district,
        beds: row.beds,
        services: row.services,
        emergencyAvailable: row.emergencyAvailable,
        extractionConfidence: row.extractionConfidence,
        ruleViolationCount: Array.isArray(row.ruleViolations)
          ? row.ruleViolations.length
          : 0,
        peerAnomalyPercentile: row.peerAnomalyPercentile,
        trustMin: row.trustMin,
        reviewStatus: row.reviewStatus,
      },
    })),
  };

  return NextResponse.json(geojson);
}
