import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { phoneVerifications, user as userTable } from "@/db/schema"
import { eq } from "drizzle-orm"
import { nanoid } from "@/lib/actions/utils"

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  return digits.startsWith("1") && digits.length === 11
    ? `+${digits}`
    : `+1${digits}`
}

export async function POST(request: NextRequest) {
  try {
    const { userId, phone } = await request.json()

    if (!userId || !phone) {
      return NextResponse.json({ error: "Missing userId or phone" }, { status: 400 })
    }

    const normalized = normalizePhone(phone)

    // Check phone is not already used by another account
    const existing = await db
      .select()
      .from(userTable)
      .where(eq(userTable.phone, normalized))
      .limit(1)

    if (existing.length > 0 && existing[0].id !== userId) {
      return NextResponse.json(
        { error: "That phone number is already linked to another account." },
        { status: 409 }
      )
    }

    const code = generateCode()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

    // Delete any previous unverified codes for this user
    await db
      .delete(phoneVerifications)
      .where(eq(phoneVerifications.userId, userId))

    // Store new code
    await db.insert(phoneVerifications).values({
      id: nanoid(),
      userId,
      phone: normalized,
      code,
      expiresAt,
      verified: false,
    })

    // Send SMS via Twilio
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const from = process.env.TWILIO_PHONE_NUMBER

    if (!accountSid || !authToken || !from) {
      // Dev mode: return code in response so it can be tested without Twilio
      console.warn("Twilio not configured — returning code in response for dev testing")
      return NextResponse.json({ success: true, devCode: code })
    }

    const { default: twilio } = await import("twilio")
    const client = twilio(accountSid, authToken)
    await client.messages.create({
      body: `Your FreshFold verification code is: ${code}. Valid for 10 minutes.`,
      from,
      to: normalized,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Send verify error:", err)
    return NextResponse.json({ error: "Failed to send code" }, { status: 500 })
  }
}
