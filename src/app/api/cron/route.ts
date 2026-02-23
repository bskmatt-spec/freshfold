import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { subscriptions, user as userTable } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { sendSms } from "@/lib/actions/sms"

// Vercel calls this endpoint daily via vercel.json cron config
// It finds all subscriptions with a nextPickup date tomorrow and sends an SMS reminder

export async function GET(request: NextRequest) {
  // Secure the endpoint with a secret so only Vercel cron can call it
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStart = new Date(tomorrow)
    tomorrowStart.setHours(0, 0, 0, 0)
    const tomorrowEnd = new Date(tomorrow)
    tomorrowEnd.setHours(23, 59, 59, 999)

    // Get all active subscriptions
    const activeSubs = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.isActive, true))

    // Filter ones with nextPickup tomorrow
    const dueTomorrow = activeSubs.filter(sub => {
      const pickup = new Date(sub.nextPickup)
      return pickup >= tomorrowStart && pickup <= tomorrowEnd
    })

    let sent = 0
    let failed = 0

    for (const sub of dueTomorrow) {
      // Get customer phone number
      const [customer] = await db
        .select()
        .from(userTable)
        .where(eq(userTable.id, sub.customerId))
        .limit(1)

      if (!customer?.phone) continue

      const pickupDate = new Date(sub.nextPickup)
      const dayName = pickupDate.toLocaleDateString("en-US", { weekday: "long" })
      const dateStr = pickupDate.toLocaleDateString("en-US", { month: "long", day: "numeric" })

      const message =
        `Hi ${customer.name}! Your FreshFold laundry pickup is scheduled for tomorrow, ${dayName} ${dateStr}. ` +
        `Please bag up your laundry and have it ready by your scheduled pickup time. ` +
        `Reply STOP to opt out.`

      const success = await sendSms(customer.phone, message)
      if (success) {
        sent++
        // Advance nextPickup based on frequency regardless of SMS outcome
        const next = new Date(sub.nextPickup)
        if (sub.frequency === "weekly") next.setDate(next.getDate() + 7)
        else if (sub.frequency === "biweekly") next.setDate(next.getDate() + 14)
        else if (sub.frequency === "monthly") next.setMonth(next.getMonth() + 1)

        await db
          .update(subscriptions)
          .set({ nextPickup: next })
          .where(eq(subscriptions.id, sub.id))
      } else {
        failed++
        // Still advance nextPickup even if SMS fails so subscriptions don't get stuck
        const next = new Date(sub.nextPickup)
        if (sub.frequency === "weekly") next.setDate(next.getDate() + 7)
        else if (sub.frequency === "biweekly") next.setDate(next.getDate() + 14)
        else if (sub.frequency === "monthly") next.setMonth(next.getMonth() + 1)

        await db
          .update(subscriptions)
          .set({ nextPickup: next })
          .where(eq(subscriptions.id, sub.id))
      }
    }

    return NextResponse.json({
      success: true,
      checked: dueTomorrow.length,
      sent,
      failed,
    })
  } catch (err) {
    console.error("Cron error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
