import { NextRequest, NextResponse } from "next/server"
import { stripe, toCents } from "@/lib/stripe"
import { db } from "@/db"
import { laundromats, orders, payments, promoCodes } from "@/db/schema"
import { eq, sql, and } from "drizzle-orm"
import { nanoid } from "@/lib/actions/utils"
import { calculatePlatformFee } from "@/lib/types"

export async function POST(request: NextRequest) {
  let orderId: string | null = null
  let paymentId: string | null = null

  try {
    const {
      laundromatId,
      serviceId,
      serviceName,
      basePrice,
      promoCode,
      customerId,
      pickupAddress,
      pickupLatitude,
      pickupLongitude,
      scheduledPickup,
      notes,
    } = await request.json()

    // Validate laundromat has a connected Stripe account
    const [laundromat] = await db
      .select()
      .from(laundromats)
      .where(eq(laundromats.id, laundromatId))
      .limit(1)

    if (!laundromat) {
      return NextResponse.json({ error: "Laundromat not found" }, { status: 404 })
    }

    if (!laundromat.stripeAccountId) {
      return NextResponse.json(
        { error: "This laundromat has not connected their Stripe account yet. Please try again later." },
        { status: 400 }
      )
    }

    // Validate promo code but DO NOT increment usage yet — webhook does that on success
    let discount = 0
    let promoCodeId: string | null = null
    if (promoCode) {
      const [promo] = await db
        .select()
        .from(promoCodes)
        .where(
          and(
            eq(sql`UPPER(${promoCodes.code})`, promoCode.toUpperCase()),
            eq(promoCodes.isActive, true)
          )
        )
        .limit(1)

      if (promo) {
        const now = new Date()
        if (
          new Date(promo.validFrom) <= now &&
          new Date(promo.validUntil) >= now &&
          promo.usageCount < promo.usageLimit
        ) {
          discount = Math.min(
            Math.round(basePrice * (promo.discountPercent / 100) * 100) / 100,
            promo.maxDiscount
          )
          promoCodeId = promo.id
        }
      }
    }

    const finalPrice = Math.max(0, basePrice - discount)
    const platformFee = calculatePlatformFee(finalPrice)
    const laundromatPayout = finalPrice - platformFee
    const totalCharge = finalPrice + platformFee

    // Create order (status: pending — confirmed by webhook on payment success)
    orderId = nanoid()
    await db.insert(orders).values({
      id: orderId,
      customerId,
      laundromatId,
      driverId: null,
      status: "pending",
      pickupAddress,
      pickupLatitude: pickupLatitude ?? 0,
      pickupLongitude: pickupLongitude ?? 0,
      deliveryAddress: pickupAddress,
      deliveryLatitude: pickupLatitude ?? 0,
      deliveryLongitude: pickupLongitude ?? 0,
      scheduledPickup: new Date(scheduledPickup),
      serviceId,
      serviceName,
      notes: notes || null,
      price: finalPrice,
      platformFee,
    })

    // Create a pending payment record
    paymentId = nanoid()
    await db.insert(payments).values({
      id: paymentId,
      orderId,
      amount: finalPrice,
      platformFee,
      laundromatPayout,
      discountAmount: discount,
      promoCode: discount > 0 ? promoCode : null,
      stripePaymentIntentId: null,
      status: "pending",
    })

    // Create Stripe PaymentIntent
    // application_fee_amount = platform fee (stays in FreshFold account)
    // transfer_data.destination = laundromat gets the rest automatically
    const paymentIntent = await stripe.paymentIntents.create({
      amount: toCents(totalCharge),
      currency: "usd",
      application_fee_amount: toCents(platformFee),
      transfer_data: {
        destination: laundromat.stripeAccountId,
      },
      metadata: {
        orderId,
        paymentId,
        customerId,
        laundromatId,
        // Pass promo info to webhook so it can increment usage on success only
        promoCode: promoCode ?? "",
        promoCodeId: promoCodeId ?? "",
      },
    })

    // Save the payment intent ID
    await db
      .update(payments)
      .set({ stripePaymentIntentId: paymentIntent.id })
      .where(eq(payments.id, paymentId))

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      orderId,
      total: totalCharge,
      breakdown: {
        service: basePrice,
        discount,
        finalPrice,
        platformFee,
        laundromatPayout,
      },
    })
  } catch (err) {
    console.error("Payment intent error:", err)

    // Clean up orphaned DB records if Stripe call failed
    if (paymentId) {
      await db.delete(payments).where(eq(payments.id, paymentId)).catch(() => {})
    }
    if (orderId) {
      await db.delete(orders).where(eq(orders.id, orderId)).catch(() => {})
    }

    return NextResponse.json({ error: "Failed to create payment. Please try again." }, { status: 500 })
  }
}
