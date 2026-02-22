import { NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"
import { db } from "@/db"
import { laundromats } from "@/db/schema"
import { eq } from "drizzle-orm"

// GET /api/stripe/connect?laundromatId=xxx
// Creates a Stripe Connect onboarding link for a laundromat
export async function GET(request: NextRequest) {
  try {
    const laundromatId = request.nextUrl.searchParams.get("laundromatId")
    if (!laundromatId) {
      return NextResponse.json({ error: "Missing laundromatId" }, { status: 400 })
    }

    const [laundromat] = await db
      .select()
      .from(laundromats)
      .where(eq(laundromats.id, laundromatId))
      .limit(1)

    if (!laundromat) {
      return NextResponse.json({ error: "Laundromat not found" }, { status: 404 })
    }

    // Create a Connect account if one doesn't exist yet
    let accountId = laundromat.stripeAccountId
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: "individual",
        ...(laundromat.email ? { email: laundromat.email } : {}),
      })
      accountId = account.id

      // Save account ID to DB
      await db
        .update(laundromats)
        .set({ stripeAccountId: accountId })
        .where(eq(laundromats.id, laundromatId))
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:4000"

    // Create an account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${baseUrl}/laundromat?stripe=refresh&id=${laundromatId}`,
      return_url: `${baseUrl}/laundromat?stripe=success&id=${laundromatId}`,
      type: "account_onboarding",
    })

    return NextResponse.json({ url: accountLink.url })
  } catch (err) {
    console.error("Stripe connect error:", err)
    return NextResponse.json({ error: "Failed to create onboarding link" }, { status: 500 })
  }
}

// GET /api/stripe/connect/status?laundromatId=xxx
// Check if a laundromat's Connect account is fully set up
export async function POST(request: NextRequest) {
  try {
    const { laundromatId } = await request.json()
    if (!laundromatId) {
      return NextResponse.json({ error: "Missing laundromatId" }, { status: 400 })
    }

    const [laundromat] = await db
      .select()
      .from(laundromats)
      .where(eq(laundromats.id, laundromatId))
      .limit(1)

    if (!laundromat?.stripeAccountId) {
      return NextResponse.json({ connected: false })
    }

    const account = await stripe.accounts.retrieve(laundromat.stripeAccountId)
    const connected =
      account.charges_enabled &&
      account.payouts_enabled &&
      account.details_submitted

    return NextResponse.json({ connected, accountId: laundromat.stripeAccountId })
  } catch (err) {
    console.error("Stripe status error:", err)
    return NextResponse.json({ connected: false })
  }
}
