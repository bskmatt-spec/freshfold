import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { session } from "@/db/schema"
import { eq } from "drizzle-orm"

export async function verifyAuth(request: NextRequest): Promise<{ userId: string | null; error?: NextResponse }> {
  const authHeader = request.headers.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    return { userId: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }
  const token = authHeader.substring(7)
  try {
    const [sessionRecord] = await db.select().from(session).where(eq(session.token, token)).limit(1)
    if (!sessionRecord || new Date(sessionRecord.expiresAt) < new Date()) {
      return { userId: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
    }
    return { userId: sessionRecord.userId }
  } catch {
    return { userId: null, error: NextResponse.json({ error: "Internal server error" }, { status: 500 }) }
  }
}
