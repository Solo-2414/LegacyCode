import { NextResponse, type NextRequest } from "next/server"
import { sessionCookieName, verifySessionToken } from "@/lib/auth-session"

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  if (pathname.startsWith("/api/auth/")) return NextResponse.next()
  const token = request.cookies.get(sessionCookieName)?.value
  const session = token ? await verifySessionToken(token) : null
  const roomRoute = pathname.match(/^\/room\/[^/]+\/(host|join|play|leaderboard)$/)
  const adminRoute = pathname === "/admin" || pathname.startsWith("/admin/") || roomRoute?.[1] === "host"
  const participantRoute = pathname === "/join" || (roomRoute && roomRoute[1] !== "host")

  if (pathname === "/") {
    if (!session) return NextResponse.next()
    return NextResponse.redirect(new URL(session.role === "ADMIN" ? "/admin/dashboard" : "/join", request.url))
  }

  if (!adminRoute && !participantRoute) return NextResponse.next()
  if (!session) return NextResponse.redirect(new URL("/", request.url))
  if (adminRoute && session.role !== "ADMIN") return NextResponse.redirect(new URL("/join", request.url))
  if (participantRoute && session.role !== "PARTICIPANT") return NextResponse.redirect(new URL("/admin/dashboard", request.url))
  return NextResponse.next()
}

export const config = {
  matcher: ["/", "/admin/:path*", "/join", "/room/:path*", "/api/auth/:path*"],
}
