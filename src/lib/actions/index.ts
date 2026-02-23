"use server"

import { db } from "@/db"
import {
  laundromats,
  services,
  orders,
  payments,
  promoCodes,
  subscriptions,
  notifications,
  user as userTable,
  Laundromat,
  Service,
  Order,
  Payment,
  PromoCode,
  Subscription,
  Notification,
  User,
} from "@/db/schema"
import { eq, and, isNull, desc, sql } from "drizzle-orm"
import { nanoid } from "./utils"
import { calculateDistance, calculateDiscount, calculatePlatformFee, RECOMMENDED_SERVICES } from "@/lib/types"

// ─── Utilities ────────────────────────────────────────────────────────────────

function generateQRCode(): string {
  return "qr_" + Math.random().toString(36).substring(2, 10).toUpperCase()
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function getUserById(id: string): Promise<User | null> {
  const [u] = await db.select().from(userTable).where(eq(userTable.id, id)).limit(1)
  return u ?? null
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const [u] = await db.select().from(userTable).where(eq(userTable.email, email)).limit(1)
  return u ?? null
}

export async function getAllUsers(): Promise<User[]> {
  return db.select().from(userTable)
}

export async function updateUser(id: string, updates: Partial<User>): Promise<User | null> {
  const [updated] = await db.update(userTable).set(updates).where(eq(userTable.id, id)).returning()
  return updated ?? null
}

export async function getDriversByLaundromat(laundromatId: string): Promise<User[]> {
  return db.select().from(userTable).where(
    and(eq(userTable.role, "driver"), eq(userTable.laundromatId, laundromatId))
  )
}

// ─── Laundromats ──────────────────────────────────────────────────────────────

export async function getAllLaundromats(): Promise<Laundromat[]> {
  return db.select().from(laundromats).orderBy(desc(laundromats.createdAt))
}

export async function getActiveLaundromats(): Promise<Laundromat[]> {
  return db.select().from(laundromats).where(eq(laundromats.isActive, true))
}

export async function getLaundromatById(id: string): Promise<Laundromat | null> {
  const [l] = await db.select().from(laundromats).where(eq(laundromats.id, id)).limit(1)
  return l ?? null
}

export async function createLaundromat(data: {
  name: string
  address: string
  latitude?: number
  longitude?: number
  deliveryRadius: number
  phone?: string
  email?: string
}): Promise<Laundromat> {
  const [l] = await db.insert(laundromats).values({
    id: nanoid(),
    name: data.name,
    address: data.address,
    latitude: data.latitude ?? 0,
    longitude: data.longitude ?? 0,
    deliveryRadius: data.deliveryRadius,
    phone: data.phone ?? "",
    email: data.email ?? "",
    qrCode: generateQRCode(),
    isActive: true,
  }).returning()
  await createDefaultServices(l.id)
  return l
}

export async function updateLaundromat(id: string, updates: Partial<Laundromat>): Promise<Laundromat | null> {
  const [updated] = await db.update(laundromats).set(updates).where(eq(laundromats.id, id)).returning()
  return updated ?? null
}

export async function findNearestLaundromat(lat: number, lon: number): Promise<Laundromat | null> {
  const active = await getActiveLaundromats()
  let nearest: Laundromat | null = null
  let minDist = Infinity
  for (const l of active) {
    const dist = calculateDistance(lat, lon, l.latitude, l.longitude)
    if (dist <= l.deliveryRadius && dist < minDist) {
      minDist = dist
      nearest = l
    }
  }
  return nearest
}

// ─── Services ─────────────────────────────────────────────────────────────────

export async function getAllServices(): Promise<Service[]> {
  return db.select().from(services)
}

export async function getServiceById(id: string): Promise<Service | null> {
  const [s] = await db.select().from(services).where(eq(services.id, id)).limit(1)
  return s ?? null
}

export async function getServicesByLaundromat(laundromatId: string): Promise<Service[]> {
  return db.select().from(services).where(eq(services.laundromatId, laundromatId))
}

export async function getActiveServicesByLaundromat(laundromatId: string): Promise<Service[]> {
  return db.select().from(services).where(
    and(eq(services.laundromatId, laundromatId), eq(services.isActive, true))
  )
}

export async function createService(data: {
  laundromatId: string
  name: string
  description: string
  price: number
  recommendedPrice: number
  isActive?: boolean
}): Promise<Service> {
  const [s] = await db.insert(services).values({ id: nanoid(), ...data, isActive: data.isActive ?? true }).returning()
  return s
}

export async function updateService(id: string, updates: Partial<Service>): Promise<Service | null> {
  const [updated] = await db.update(services).set(updates).where(eq(services.id, id)).returning()
  return updated ?? null
}

export async function deleteService(id: string): Promise<boolean> {
  await db.delete(services).where(eq(services.id, id))
  return true
}

export async function createDefaultServices(laundromatId: string): Promise<Service[]> {
  const created: Service[] = []
  for (const rec of RECOMMENDED_SERVICES) {
    const s = await createService({
      laundromatId,
      name: rec.name,
      description: rec.description,
      price: rec.recommendedPrice,
      recommendedPrice: rec.recommendedPrice,
      isActive: true,
    })
    created.push(s)
  }
  return created
}

// ─── Orders ───────────────────────────────────────────────────────────────────

export async function getAllOrders(): Promise<Order[]> {
  return db.select().from(orders).orderBy(desc(orders.createdAt))
}

export async function getOrderById(id: string): Promise<Order | null> {
  const [o] = await db.select().from(orders).where(eq(orders.id, id)).limit(1)
  return o ?? null
}

export async function getOrdersByCustomer(customerId: string): Promise<Order[]> {
  return db.select().from(orders).where(eq(orders.customerId, customerId)).orderBy(desc(orders.createdAt))
}

export async function getOrdersByLaundromat(laundromatId: string): Promise<Order[]> {
  return db.select().from(orders).where(eq(orders.laundromatId, laundromatId)).orderBy(desc(orders.createdAt))
}

export async function getAvailableOrdersForDriver(laundromatId: string): Promise<Order[]> {
  return db.select().from(orders).where(
    and(eq(orders.status, "pending"), isNull(orders.driverId), eq(orders.laundromatId, laundromatId))
  ).orderBy(desc(orders.createdAt))
}

export async function createOrder(data: Omit<Order, "id" | "createdAt" | "updatedAt">): Promise<Order> {
  const [o] = await db.insert(orders).values({ id: nanoid(), ...data }).returning()
  return o
}

export async function updateOrder(id: string, updates: Partial<Order>): Promise<Order | null> {
  const [updated] = await db.update(orders).set(updates).where(eq(orders.id, id)).returning()
  return updated ?? null
}

// ─── Payments ─────────────────────────────────────────────────────────────────

export async function getAllPayments(): Promise<Payment[]> {
  return db.select().from(payments).orderBy(desc(payments.createdAt))
}

export async function getPaymentByOrder(orderId: string): Promise<Payment | null> {
  const [p] = await db.select().from(payments).where(eq(payments.orderId, orderId)).limit(1)
  return p ?? null
}

export async function createPayment(data: Omit<Payment, "id" | "createdAt">): Promise<Payment> {
  const [p] = await db.insert(payments).values({ id: nanoid(), ...data }).returning()
  return p
}

// ─── Promo Codes ──────────────────────────────────────────────────────────────

export async function getAllPromoCodes(): Promise<PromoCode[]> {
  return db.select().from(promoCodes).orderBy(desc(promoCodes.createdAt))
}

export async function getPromoByCode(code: string): Promise<PromoCode | null> {
  const [p] = await db.select().from(promoCodes).where(
    and(eq(sql`UPPER(${promoCodes.code})`, code.toUpperCase()), eq(promoCodes.isActive, true))
  ).limit(1)
  return p ?? null
}

export async function createPromoCode(data: Omit<PromoCode, "id" | "createdAt" | "usageCount">): Promise<PromoCode> {
  const [p] = await db.insert(promoCodes).values({ id: nanoid(), ...data, usageCount: 0 }).returning()
  return p
}

export async function updatePromoCode(id: string, updates: Partial<PromoCode>): Promise<PromoCode | null> {
  const [updated] = await db.update(promoCodes).set(updates).where(eq(promoCodes.id, id)).returning()
  return updated ?? null
}

export async function validatePromoCode(code: string): Promise<{ valid: boolean; promoCode?: PromoCode; message?: string }> {
  const promoCode = await getPromoByCode(code)
  if (!promoCode) return { valid: false, message: "Invalid promo code" }
  const now = new Date()
  if (new Date(promoCode.validFrom) > now) return { valid: false, message: "Promo code not yet active" }
  if (new Date(promoCode.validUntil) < now) return { valid: false, message: "Promo code expired" }
  if (promoCode.usageCount >= promoCode.usageLimit) return { valid: false, message: "Promo code usage limit reached" }
  return { valid: true, promoCode }
}

export async function applyPromoCode(code: string, amount: number): Promise<{ success: boolean; discount: number; finalAmount: number; message?: string }> {
  const validation = await validatePromoCode(code)
  if (!validation.valid || !validation.promoCode) {
    return { success: false, discount: 0, finalAmount: amount, message: validation.message }
  }
  const { promoCode } = validation
  const discount = calculateDiscount(amount, promoCode.discountPercent, promoCode.maxDiscount)
  await updatePromoCode(promoCode.id, { usageCount: promoCode.usageCount + 1 })
  return { success: true, discount, finalAmount: amount - discount }
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

export async function getSubscriptionsByCustomer(customerId: string): Promise<Subscription[]> {
  return db.select().from(subscriptions).where(
    and(eq(subscriptions.customerId, customerId), eq(subscriptions.isActive, true))
  )
}

export async function getSubscriptionsByLaundromat(laundromatId: string): Promise<Subscription[]> {
  return db.select().from(subscriptions).where(
    and(eq(subscriptions.laundromatId, laundromatId), eq(subscriptions.isActive, true))
  )
}

export async function createSubscription(data: Omit<Subscription, "id" | "createdAt">): Promise<Subscription> {
  const [s] = await db.insert(subscriptions).values({ id: nanoid(), ...data }).returning()
  return s
}

export async function cancelSubscription(id: string): Promise<boolean> {
  await db.update(subscriptions).set({ isActive: false }).where(eq(subscriptions.id, id))
  return true
}

// ─── Notifications ────────────────────────────────────────────────────────────

export async function getNotificationsByUser(userId: string): Promise<Notification[]> {
  return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt))
}

export async function getUnreadNotificationsByUser(userId: string): Promise<Notification[]> {
  return db.select().from(notifications).where(
    and(eq(notifications.userId, userId), eq(notifications.isRead, false))
  )
}

export async function markNotificationRead(id: string): Promise<void> {
  await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id))
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, userId))
}

export async function createOrderStatusNotification(userId: string, orderId: string, status: string): Promise<void> {
  const statusMessages: Record<string, string> = {
    pending: "Your order has been received and is pending pickup",
    picked_up: "Your laundry has been picked up",
    in_progress: "Your laundry is being processed",
    delivered: "Your laundry has been delivered!",
    cancelled: "Your order has been cancelled",
  }
  await db.insert(notifications).values({
    id: nanoid(),
    userId,
    orderId,
    type: "order_status",
    title: "Order Update",
    message: statusMessages[status] ?? "Your order status has been updated",
    isRead: false,
  })
}

// ─── Laundromat Invites ───────────────────────────────────────────────────────

export async function getLaundromatByInviteToken(token: string): Promise<Laundromat | null> {
  const [l] = await db.select().from(laundromats).where(eq(laundromats.inviteToken, token)).limit(1)
  return l ?? null
}

export async function sendLaundromatInvite(
  laundromatId: string,
  ownerEmail: string,
  siteUrl: string
): Promise<{ success: boolean; message: string }> {
  // Generate a secure random token
  const token = nanoid() + nanoid()

  // Save token + email to laundromat
  const [l] = await db
    .update(laundromats)
    .set({ inviteToken: token, inviteEmail: ownerEmail })
    .where(eq(laundromats.id, laundromatId))
    .returning()

  if (!l) return { success: false, message: "Laundromat not found" }

  const inviteUrl = `${siteUrl}/laundromat/invite?token=${token}`

  // Send email via Resend if API key present, otherwise log to console
  const apiKey = process.env.RESEND_API_KEY
  if (apiKey) {
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "FreshFold <noreply@freshfold-blue.vercel.app>",
          to: ownerEmail,
          subject: `You've been invited to manage ${l.name} on FreshFold`,
          html: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
              <h2 style="color:#4f46e5">FreshFold Staff Invitation</h2>
              <p>You've been invited to manage <strong>${l.name}</strong> on FreshFold.</p>
              <p>Click the button below to set up your account and access the laundromat portal.</p>
              <a href="${inviteUrl}" style="display:inline-block;margin:16px 0;padding:12px 24px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold">
                Accept Invitation
              </a>
              <p style="color:#666;font-size:13px">This link is unique to you. If you did not expect this email, you can ignore it.</p>
              <p style="color:#999;font-size:12px">FreshFold · Laundry pickup &amp; delivery</p>
            </div>
          `,
        }),
      })
    } catch (err) {
      console.error("Resend email failed:", err)
      return { success: false, message: "Failed to send invite email" }
    }
  } else {
    // Dev mode — log the URL
    console.log(`[DEV] Invite URL for ${ownerEmail}: ${inviteUrl}`)
  }

  return { success: true, message: `Invite sent to ${ownerEmail}` }
}
