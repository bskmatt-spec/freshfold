"use client"
import { createAuthClient } from "better-auth/react"
import { useEffect, useState } from "react"

export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined"
    ? window.location.origin
    : process.env.NEXT_PUBLIC_SITE_URL,
  fetchOptions: {
    headers: {
      Authorization: `Bearer ${typeof window !== "undefined" ? localStorage.getItem("bearer_token") : ""}`,
    },
    onSuccess: (ctx) => {
      const authToken = ctx.response.headers.get("set-auth-token")
      if (authToken) {
        // store the full token (not just the first segment)
        localStorage.setItem("bearer_token", authToken)
      }
    },
  },
})

export function getAuthHeaders(): HeadersInit {
  const token = typeof window !== "undefined" ? localStorage.getItem("bearer_token") : ""
  return {
    "Content-Type": "application/json",
    Authorization: token ? `Bearer ${token}` : "",
  }
}

export function useSession() {
  const [session, setSession] = useState<any>(null)
  const [isPending, setIsPending] = useState(true)
  const [error, setError] = useState<any>(null)

  const fetchSession = async () => {
    try {
      const res = await authClient.getSession({
        fetchOptions: {
          auth: {
            type: "Bearer",
            token: typeof window !== "undefined" ? localStorage.getItem("bearer_token") ?? "" : "",
          },
        },
      })
      setSession(res.data)
      setError(null)
    } catch (err) {
      setSession(null)
      setError(err)
    } finally {
      setIsPending(false)
    }
  }

  useEffect(() => {
    fetchSession()
  }, [])

  return { data: session, isPending, error, refetch: fetchSession }
}
