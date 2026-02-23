import { NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"
import { db } from "@/db"
import { payments, orders, notifications, promoCodes } from "@/db/schema"
import { eq } from "drizzle-orm"
import { nanoid } from "@/lib/actions/utils"
import type Stripe from "stripe"

export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get("stripe-signature")
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!webhookSecret || !sig) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err) {
    console.error("Webhook signature error:", err)
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  if (event.type === "payment_intent.succeeded") {
    const intent = event.data.object as Stripe.PaymentIntent
    const { orderId, paymentId, customerId, promoCodeId } = intent.metadata ?? {}

    if (paymentId) {
      await db
        .update(payments)
        .set({ status: "completed" })
        .where(eq(payments.id, paymentId))
    }

    if (orderId) {
      await db
        .update(orders)
        .set({ status: "pending" })
        .where(eq(orders.id, orderId))
    }

    // Increment promo usage now that payment actually succeeded
    if (promoCodeId) {
      const [promo] = await db
        .select()
        .from(promoCodes)
        .where(eq(promoCodes.id, promoCodeId))
        .limit(1)
      if (promo) {
        await db
          .update(promoCodes)
          .set({ usageCount: promo.usageCount + 1 })
          .where(eq(promoCodes.id, promo.id))
      }
    }

    if (customerId && orderId) {
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
    const intent = event.data.object as Stripe.PaymentIntent
    const { paymentId, orderId, promoCode } = intent.metadata ?? {}

    if (paymentId) {
      await db
        .update(payments)
        .set({ status: "failed" })
        .where(eq(payments.id, paymentId))
    }

    // Cancel the order since payment failed
    if (orderId) {
      await db
        .update(orders)
        .set({ status: "cancelled" })
        .where(eq(orders.id, orderId))
    }

    // Refund the promo code usage so it can be used again
    if (promoCode) {
      const [promo] = await db
        .select()
        .from(promoCodes)
        .where(eq(promoCodes.code, promoCode))
        .limit(1)
      if (promo && promo.usageCount > 0) {
        await db
          .update(promoCodes)
          .set({ usageCount: promo.usageCount - 1 })
          .where(eq(promoCodes.id, promo.id))
      }
    }
  }

  if (event.type === "payment_intent.canceled") {
    const intent = event.data.object as Stripe.PaymentIntent
    const { paymentId, orderId, promoCode } = intent.metadata ?? {}

    if (paymentId) {
      await db
        .update(payments)
        .set({ status: "failed" })
        .where(eq(payments.id, paymentId))
    }

    if (orderId) {
      await db
        .update(orders)
        .set({ status: "cancelled" })
        .where(eq(orders.id, orderId))
    }

    // Refund promo usage on cancellation too
    if (promoCode) {
      const [promo] = await db
        .select()
        .from(promoCodes)
        .where(eq(promoCodes.code, promoCode))
        .limit(1)
      if (promo && promo.usageCount > 0) {
        await db
          .update(promoCodes)
          .set({ usageCount: promo.usageCount - 1 })
          .where(eq(promoCodes.id, promo.id))
      }
    }
  }

  return NextResponse.json({ received: true })
}
