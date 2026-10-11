import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { sessionCookieName, verifySessionToken } from "@/lib/auth-session"

// Returns the signed-in user's session token so the browser can send it to the API as a Bearer token.
// This lets the API live on a different domain than the website (no shared cookie domain needed).
export async function GET(request: Request) {
  const fetchSite = request.headers.get("sec-fetch-site")
  if (fetchSite && fetchSite !== "same-origin") {
    return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 })
  }
  const token = (await cookies()).get(sessionCookieName)?.value
  const session = token ? await verifySessionToken(token) : null
  if (!token || !session) return NextResponse.json({ error: "Not signed in." }, { status: 401, headers: { "Cache-Control": "no-store" } })
  return NextResponse.json({ token }, { headers: { "Cache-Control": "no-store" } })
}
