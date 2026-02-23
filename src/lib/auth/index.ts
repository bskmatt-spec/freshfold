import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { bearer } from "better-auth/plugins"
import { headers } from "next/headers"
import { db } from "@/db"
import * as schema from "@/db/schema"

export const auth = betterAuth({
  appName: "FreshFold",
  // Do NOT hardcode baseURL — let Better Auth derive it from the incoming request.
  // A hardcoded value causes "invalid origin" on preview URLs, E2B sandboxes, etc.
  baseURL: undefined,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }) => {
      const apiKey = process.env.BREVO_API_KEY
      if (!apiKey) {
        console.warn("BREVO_API_KEY not set — password reset URL:", url)
        return
      }
      const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sender: { name: "FreshFold", email: "bskmatt@gmail.com" },
          to: [{ email: user.email, name: user.name ?? user.email }],
          subject: "Reset your FreshFold password",
          htmlContent: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
              <h2 style="color:#3b82f6">Reset your password</h2>
              <p>Hi ${user.name ?? "there"},</p>
              <p>We received a request to reset your FreshFold password. Click the button below to choose a new one.</p>
              <a href="${url}" style="display:inline-block;margin:16px 0;padding:12px 24px;background:#3b82f6;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Reset Password</a>
              <p style="color:#6b7280;font-size:14px">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
              <p style="color:#6b7280;font-size:14px">— The FreshFold Team</p>
            </div>
          `,
        }),
      })
      if (!res.ok) {
        const err = await res.text()
        console.error("Brevo email error:", err)
      }
    },
  },
  plugins: [bearer()],
  // Accept requests from any origin. Origin-pinning is not needed because
  // Better Auth validates requests via signed session tokens / BETTER_AUTH_SECRET.
  // Previously this was hardcoded to a single Vercel URL which broke all
  // preview deployments and the E2B sandbox.
  trustedOrigins: ["*"],
})

export async function getCurrentUser() {
  const session = await auth.api.getSession({ headers: await headers() })
  return session?.user ?? null
}
