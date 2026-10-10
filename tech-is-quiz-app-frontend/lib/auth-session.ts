import { jwtVerify } from "jose"

export const sessionCookieName = "techis_session"
export const sessionMaxAgeSeconds = 8 * 60 * 60
export type UserRole = "SUPERADMIN" | "ADMIN" | "PARTICIPANT"
export type UserSession = { userId: string; name: string; role: UserRole }

export async function verifySessionToken(token: string): Promise<UserSession | null> {
  const secret = process.env.AUTH_SECRET
  if (!secret || secret.length < 32) return null
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ["HS256"] })
    if (!payload.sub || typeof payload.name !== "string" || (payload.role !== "SUPERADMIN" && payload.role !== "ADMIN" && payload.role !== "PARTICIPANT")) return null
    return { userId: payload.sub, name: payload.name, role: payload.role }
  } catch {
    return null
  }
}
