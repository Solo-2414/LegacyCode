import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { sessionCookieName, verifySessionToken } from "@/lib/auth-session"

export async function GET() {
  const token = (await cookies()).get(sessionCookieName)?.value
  return NextResponse.json({ session: token ? await verifySessionToken(token) : null })
}
