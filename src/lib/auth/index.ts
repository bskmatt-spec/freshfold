import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { bearer } from "better-auth/plugins"
import { headers } from "next/headers"
import { db } from "@/db"
import * as schema from "@/db/schema"

export const auth = betterAuth({
  appName: "FreshFold",
  baseURL: process.env.NEXT_PUBLIC_SITE_URL,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: { enabled: true },
  plugins: [bearer()],
  trustedOrigins: ["*"],
})

export async function getCurrentUser() {
  const session = await auth.api.getSession({ headers: await headers() })
  return session?.user ?? null
}
