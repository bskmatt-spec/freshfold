import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { phoneVerifications, user as userTable } from "@/db/schema"
import { eq, and } from "drizzle-orm"

export async function POST(request: NextRequest) {
  try {
    const { userId, code } = await request.json()

    if (!userId || !code) {
      return NextResponse.json({ error: "Missing userId or code" }, { status: 400 })
    }

    const [record] = await db
      .select()
      .from(phoneVerifications)
      .where(
        and(
          eq(phoneVerifications.userId, userId),
          eq(phoneVerifications.verified, false)
        )
      )
      .limit(1)

    if (!record) {
      return NextResponse.json({ error: "No pending verification found. Please request a new code." }, { status: 404 })
    }

    if (new Date() > record.expiresAt) {
      return NextResponse.json({ error: "Code has expired. Please request a new one." }, { status: 410 })
    }

    if (record.code !== code.trim()) {
      return NextResponse.json({ error: "Incorrect code. Please try again." }, { status: 400 })
    }

    // Mark verified and save phone to user record
    await db
      .update(phoneVerifications)
      .set({ verified: true })
      .where(eq(phoneVerifications.id, record.id))

    await db
      .update(userTable)
      .set({ phone: record.phone })
      .where(eq(userTable.id, userId))

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Confirm verify error:", err)
    return NextResponse.json({ error: "Verification failed" }, { status: 500 })
  }
}
