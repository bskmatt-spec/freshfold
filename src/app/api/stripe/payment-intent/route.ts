import { NextRequest, NextResponse } from "next/server"
import { stripe, toCents } from "@/lib/stripe"
import { db } from "@/db"
import { laundromats, orders, payments, promoCodes } from "@/db/schema"
import { eq, sql, and } from "drizzle-orm"
import { nanoid } from "@/lib/actions/utils"
import { calculatePlatformFee } from "@/lib/types"

export async function POST(request: NextRequest) {
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
        { error: "This laundromat has not connected their Stripe account yet." },
        { status: 400 }
      )
    }

    // Calculate discount if promo code provided
    let discount = 0
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
          // Increment usage count
          await db
            .update(promoCodes)
            .set({ usageCount: promo.usageCount + 1 })
            .where(eq(promoCodes.id, promo.id))
        }
      }
    }

    const finalPrice = Math.max(0, basePrice - discount)
    const platformFee = calculatePlatformFee(finalPrice)
    const laundromatPayout = finalPrice - platformFee
    const totalCharge = finalPrice + platformFee

    // Create the order first (pending payment)
    const [order] = await db
      .insert(orders)
      .values({
        id: nanoid(),
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
      .returning()

    // Create a pending payment record
    const paymentId = nanoid()
    await db.insert(payments).values({
      id: paymentId,
      orderId: order.id,
      amount: finalPrice,
      platformFee,
      laundromatPayout,
      discountAmount: discount,
      promoCode: discount > 0 ? promoCode : null,
      stripePaymentIntentId: null,
      status: "pending",
    })

    // Create Stripe PaymentIntent with Connect transfer
    // application_fee_amount = platform fee (what FreshFold keeps)
    // transfer_data.destination = laundromat's Stripe account (gets the rest)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: toCents(totalCharge),
      currency: "usd",
      application_fee_amount: toCents(platformFee),
      transfer_data: {
        destination: laundromat.stripeAccountId,
      },
      metadata: {
        orderId: order.id,
        paymentId,
        customerId,
        laundromatId,
      },
    })

    // Save the payment intent ID
    await db
      .update(payments)
      .set({ stripePaymentIntentId: paymentIntent.id })
      .where(eq(payments.id, paymentId))

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      orderId: order.id,
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
    return NextResponse.json({ error: "Failed to create payment" }, { status: 500 })
  }
}
