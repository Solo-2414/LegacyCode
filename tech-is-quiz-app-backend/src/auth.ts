import { randomBytes, randomUUID, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto"
import { promisify } from "node:util"
import { SignJWT, jwtVerify } from "jose"
import { query } from "./database.js"

export type UserRole = "ADMIN" | "PARTICIPANT"
export type SessionUser = { userId: string; name: string; role: UserRole }
export type UserRecord = SessionUser & { email: string; passwordSalt: string; passwordHash: string }

const scrypt = promisify(nodeScrypt)

function sessionSecret() {
  const secret = process.env.AUTH_SECRET
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET must be configured with at least 32 characters.")
  return new TextEncoder().encode(secret)
}

export async function loadUsers() {
  await query("SELECT 1 FROM users LIMIT 1")
}

async function hashPassword(password: string, salt: string) {
  const derived = await scrypt(password, salt, 64) as Buffer
  return derived.toString("base64url")
}

export async function authenticateUser(email: string, password: string) {
  const result = await query<UserRow>("SELECT id, email, name, role, password_salt, password_hash FROM users WHERE email = $1", [email.trim().toLocaleLowerCase()])
  const row = result.rows[0]
  const user = row && toUserRecord(row)
  if (!user) return null
  const actual = Buffer.from(await hashPassword(password, user.passwordSalt), "base64url")
  const expected = Buffer.from(user.passwordHash, "base64url")
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null
  return user
}

export async function createUser(email: string, name: string, role: UserRole, password: string) {
  const normalizedEmail = email.trim().toLocaleLowerCase()
  if (!normalizedEmail || !name.trim() || password.length < 12) throw new Error("Email, name, and a password of at least 12 characters are required.")
  if (role !== "ADMIN" && role !== "PARTICIPANT") throw new Error("Role must be ADMIN or PARTICIPANT.")
  const passwordSalt = randomBytes(16).toString("base64url")
  const passwordHash = await hashPassword(password, passwordSalt)
  try {
    const result = await query<UserRow>(
      "INSERT INTO users (id, email, name, role, password_salt, password_hash) VALUES ($1, $2, $3, $4::user_role, $5, $6) RETURNING id, email, name, role, password_salt, password_hash",
      [randomUUID(), normalizedEmail, name.trim(), role, passwordSalt, passwordHash],
    )
    return toUserRecord(result.rows[0])
  } catch (error) {
    if ((error as { code?: string }).code === "23505") throw new Error("A user with this email already exists.")
    throw error
  }
}

type UserRow = { id: string; email: string; name: string; role: UserRole; password_salt: string; password_hash: string }

function toUserRecord(row: UserRow): UserRecord {
  return { userId: row.id, email: row.email, name: row.name, role: row.role, passwordSalt: row.password_salt, passwordHash: row.password_hash }
}

export async function createSessionToken(user: UserRecord) {
  return new SignJWT({ name: user.name, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.userId)
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(sessionSecret())
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, sessionSecret(), { algorithms: ["HS256"] })
    if (!payload.sub || typeof payload.name !== "string" || (payload.role !== "ADMIN" && payload.role !== "PARTICIPANT")) return null
    return { userId: payload.sub, name: payload.name, role: payload.role }
  } catch {
    return null
  }
}

export function validateAuthConfiguration() {
  sessionSecret()
}