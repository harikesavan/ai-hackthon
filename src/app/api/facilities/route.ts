import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { facilities } from "@/lib/db/schema";
import { eq, and, lte, sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const state = params.get("state");
  const district = params.get("district");
  const maxTrust = params.get("max_trust");
  const facilityType = params.get("type");
  const limit = parseInt(params.get("limit") || "100");

  const conditions = [];
  if (state) conditions.push(eq(facilities.state, state));
  if (district) conditions.push(eq(facilities.district, district));
  if (facilityType) conditions.push(eq(facilities.facilityType, facilityType));
  if (maxTrust) conditions.push(lte(facilities.trustMin, parseFloat(maxTrust)));

  const results = await db
    .select()
    .from(facilities)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .limit(limit);

  return NextResponse.json({ facilities: results, count: results.length });
}
