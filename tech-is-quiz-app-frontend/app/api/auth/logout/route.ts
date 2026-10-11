import { NextResponse } from "next/server"
import { sessionCookieDomain, sessionCookieName } from "@/lib/auth-session"

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 })
  }
  const response = NextResponse.json({ ok: true })
  response.cookies.set(sessionCookieName, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    domain: sessionCookieDomain,
    maxAge: 0,
  })
  return response
}
