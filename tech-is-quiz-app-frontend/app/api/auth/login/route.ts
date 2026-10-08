import { NextResponse } from "next/server"
import { API_URL } from "@/lib/quiz-api"
import { sessionCookieName, sessionMaxAgeSeconds, type UserSession } from "@/lib/auth-session"

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 })
  }
  let credentials: { email?: unknown; password?: unknown }
  try {
    credentials = await request.json() as { email?: unknown; password?: unknown }
  } catch {
    return NextResponse.json({ error: "Enter a valid email and password." }, { status: 400 })
  }
  if (typeof credentials.email !== "string" || typeof credentials.password !== "string") {
    return NextResponse.json({ error: "Enter a valid email and password." }, { status: 400 })
  }

  let backendResponse: Response
  try {
    backendResponse = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
      cache: "no-store",
    })
  } catch {
    return NextResponse.json({ error: "The sign-in service is unavailable." }, { status: 503 })
  }
  const result = await backendResponse.json().catch(() => ({})) as { token?: string; session?: UserSession; error?: string }
  if (!backendResponse.ok || !result.token || !result.session) {
    return NextResponse.json({ error: result.error ?? "Email or password is incorrect." }, { status: backendResponse.status || 401 })
  }

  const response = NextResponse.json({ session: result.session })
  response.cookies.set(sessionCookieName, result.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: sessionMaxAgeSeconds,
  })
  return response
}
