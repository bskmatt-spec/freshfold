import {
  pgTable,
  text,
  timestamp,
  boolean,
  real,
  integer,
} from "drizzle-orm/pg-core"

// ─── Better Auth tables ───────────────────────────────────────────────────────

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
  // App-specific fields on the user record
  phone: text("phone").default("").notNull(),
  role: text("role").default("customer").notNull(), // customer | laundromat_staff | driver | admin
  laundromatId: text("laundromat_id"),
})

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").$onUpdate(() => new Date()).notNull(),
})

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").$onUpdate(() => new Date()).notNull(),
})

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
})

// ─── App tables ───────────────────────────────────────────────────────────────

export const laundromats = pgTable("laundromats", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  latitude: real("latitude").default(0).notNull(),
  longitude: real("longitude").default(0).notNull(),
  deliveryRadius: real("delivery_radius").notNull(),
  qrCode: text("qr_code").notNull(),
  phone: text("phone").default("").notNull(),
  email: text("email").default("").notNull(),
  stripeAccountId: text("stripe_account_id"),
  inviteToken: text("invite_token"),
  inviteEmail: text("invite_email"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const services = pgTable("services", {
  id: text("id").primaryKey(),
  laundromatId: text("laundromat_id").notNull().references(() => laundromats.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull(),
  price: real("price").notNull(),
  recommendedPrice: real("recommended_price").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const orders = pgTable("orders", {
  id: text("id").primaryKey(),
  customerId: text("customer_id").notNull().references(() => user.id),
  laundromatId: text("laundromat_id").notNull().references(() => laundromats.id),
  driverId: text("driver_id").references(() => user.id),
  status: text("status").default("pending").notNull(), // pending | picked_up | in_progress | delivered | cancelled
  pickupAddress: text("pickup_address").notNull(),
  pickupLatitude: real("pickup_latitude").notNull(),
  pickupLongitude: real("pickup_longitude").notNull(),
  deliveryAddress: text("delivery_address").notNull(),
  deliveryLatitude: real("delivery_latitude").notNull(),
  deliveryLongitude: real("delivery_longitude").notNull(),
  scheduledPickup: timestamp("scheduled_pickup").notNull(),
  serviceId: text("service_id").notNull(),
  serviceName: text("service_name").notNull(),
  notes: text("notes"),
  price: real("price").notNull(),
  platformFee: real("platform_fee").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
})

export const payments = pgTable("payments", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull().references(() => orders.id),
  amount: real("amount").notNull(),
  platformFee: real("platform_fee").notNull(),
  laundromatPayout: real("laundromat_payout").notNull(),
  discountAmount: real("discount_amount").default(0).notNull(),
  promoCode: text("promo_code"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  status: text("status").default("pending").notNull(), // pending | completed | failed
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const promoCodes = pgTable("promo_codes", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  discountPercent: integer("discount_percent").notNull(),
  maxDiscount: real("max_discount").notNull(),
  validFrom: timestamp("valid_from").notNull(),
  validUntil: timestamp("valid_until").notNull(),
  usageLimit: integer("usage_limit").notNull(),
  usageCount: integer("usage_count").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const subscriptions = pgTable("subscriptions", {
  id: text("id").primaryKey(),
  customerId: text("customer_id").notNull().references(() => user.id),
  laundromatId: text("laundromat_id").notNull().references(() => laundromats.id),
  serviceId: text("service_id").notNull(),
  frequency: text("frequency").notNull(), // weekly | biweekly | monthly
  pickupDay: text("pickup_day").notNull(),
  price: real("price").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  nextPickup: timestamp("next_pickup").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const notifications = pgTable("notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id),
  orderId: text("order_id"),
  type: text("type").notNull(), // order_status | promo | subscription | system
  title: text("title").notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const phoneVerifications = pgTable("phone_verifications", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  phone: text("phone").notNull(),
  code: text("code").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  verified: boolean("verified").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

// ─── Inferred types ───────────────────────────────────────────────────────────

export type User = typeof user.$inferSelect
export type Laundromat = typeof laundromats.$inferSelect
export type Service = typeof services.$inferSelect
export type Order = typeof orders.$inferSelect
export type Payment = typeof payments.$inferSelect
export type PromoCode = typeof promoCodes.$inferSelect
export type Subscription = typeof subscriptions.$inferSelect
export type Notification = typeof notifications.$inferSelect
export type PhoneVerification = typeof phoneVerifications.$inferSelect
