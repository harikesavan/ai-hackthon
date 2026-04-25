import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { facilities } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { facilityId, status } = body;

  const validStatuses = [
    "pending",
    "confirmed_real",
    "confirmed_ghost",
    "needs_visit",
  ];

  if (!facilityId || !validStatuses.includes(status)) {
    return NextResponse.json(
      { error: "Invalid facilityId or status" },
      { status: 400 }
    );
  }

  await db
    .update(facilities)
    .set({
      reviewStatus: status,
      reviewedAt: new Date(),
    })
    .where(eq(facilities.id, facilityId));

  return NextResponse.json({ success: true, facilityId, status });
}
