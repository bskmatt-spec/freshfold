import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const headers = Object.fromEntries(req.headers.entries())
  const payload = {
    origin: headers.origin ?? null,
    referer: headers.referer ?? null,
    host: headers.host ?? null,
    "x-forwarded-host": headers["x-forwarded-host"] ?? null,
    "x-forwarded-for": headers["x-forwarded-for"] ?? null,
    forwarded: headers.forwarded ?? null,
    "user-agent": headers["user-agent"] ?? null,
    allHeaders: headers,
  }

  return NextResponse.json(payload)
}

export async function GET(req: Request) {
  // support GET for quick manual checks (note: Origin header is only present for fetch/XHR)
  const headers = Object.fromEntries(req.headers.entries())
  const payload = {
    origin: headers.origin ?? null,
    referer: headers.referer ?? null,
    host: headers.host ?? null,
    "x-forwarded-host": headers["x-forwarded-host"] ?? null,
    "x-forwarded-for": headers["x-forwarded-for"] ?? null,
    forwarded: headers.forwarded ?? null,
    "user-agent": headers["user-agent"] ?? null,
    allHeaders: headers,
  }

  return NextResponse.json(payload)
}
