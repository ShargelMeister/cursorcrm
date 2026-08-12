import { eq, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { crmState } from "../../../db/schema";

export async function GET() {
  try {
    const db = getDb();
    const [row] = await db.select().from(crmState).where(eq(crmState.id, 1)).limit(1);
    return Response.json({ state: row ? JSON.parse(row.payload) : null });
  } catch (error) {
    return Response.json({ state: null, local: true, error: error instanceof Error ? error.message : "Database unavailable" });
  }
}

export async function PUT(request: Request) {
  try {
    const state = await request.json();
    const payload = JSON.stringify(state);
    if (payload.length > 2_000_000) return Response.json({ error: "State is too large" }, { status: 413 });
    const db = getDb();
    await db.insert(crmState).values({ id: 1, payload }).onConflictDoUpdate({ target: crmState.id, set: { payload, updatedAt: sql`CURRENT_TIMESTAMP` } });
    return Response.json({ saved: true });
  } catch (error) {
    return Response.json({ saved: false, error: error instanceof Error ? error.message : "Database unavailable" }, { status: 500 });
  }
}
