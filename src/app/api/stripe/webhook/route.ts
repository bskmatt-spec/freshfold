import { NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"
import { db } from "@/db"
import { payments, notifications } from "@/db/schema"
import { eq } from "drizzle-orm"
import { nanoid } from "@/lib/actions/utils"

export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get("stripe-signature")
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!webhookSecret || !sig) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 400 })
  }

  let event: ReturnType<typeof stripe.webhooks.constructEvent> extends Promise<infer T> ? T : ReturnType<typeof stripe.webhooks.constructEvent>

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err) {
    console.error("Webhook signature error:", err)
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  if (event.type === "payment_intent.succeeded") {
    const intent = event.data.object
    const { orderId, paymentId, customerId } = intent.metadata ?? {}

    if (paymentId) {
      // Mark payment as completed
      await db
        .update(payments)
        .set({ status: "completed" })
        .where(eq(payments.id, paymentId))
    }

    if (customerId && orderId) {
      // Send in-app notification
      await db.insert(notifications).values({
        id: nanoid(),
        userId: customerId,
        orderId,
        type: "order_status",
        title: "Payment confirmed",
        message: "Your payment was successful. Your laundry pickup is confirmed!",
        isRead: false,
      })
    }
  }

  if (event.type === "payment_intent.payment_failed") {
    const intent = event.data.object
    const { paymentId } = intent.metadata ?? {}

    if (paymentId) {
      await db
        .update(payments)
        .set({ status: "failed" })
        .where(eq(payments.id, paymentId))
    }
  }

  return NextResponse.json({ received: true })
}
