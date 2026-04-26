import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { facilities } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const rows = await db
    .select()
    .from(facilities)
    .where(eq(facilities.id, numericId))
    .limit(1);

  if (rows.length === 0) {
    return NextResponse.json({ error: "Facility not found" }, { status: 404 });
  }

  return NextResponse.json(rows[0]);
}
