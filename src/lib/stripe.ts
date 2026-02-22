import Stripe from "stripe"

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2026-01-28.clover",
})

// Convert dollars to cents for Stripe
export function toCents(dollars: number): number {
  return Math.round(dollars * 100)
}
