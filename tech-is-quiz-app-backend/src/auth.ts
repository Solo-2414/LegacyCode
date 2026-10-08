import { randomBytes, randomUUID, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto"
import { promisify } from "node:util"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"
import { SignJWT, jwtVerify } from "jose"
import { dataDirectory } from "./paths.js"

export type UserRole = "ADMIN" | "PARTICIPANT"
export type SessionUser = { userId: string; name: string; role: UserRole }
export type UserRecord = SessionUser & { email: string; passwordSalt: string; passwordHash: string }

const userFile = path.join(dataDirectory, "users.json")
const scrypt = promisify(nodeScrypt)
let users: UserRecord[] = []

function sessionSecret() {
  const secret = process.env.AUTH_SECRET
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET must be configured with at least 32 characters.")
  return new TextEncoder().encode(secret)
}

export async function loadUsers() {
  try {
    users = JSON.parse(await readFile(userFile, "utf8")) as UserRecord[]
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
    users = []
  }
}

async function persistUsers() {
  await mkdir(dataDirectory, { recursive: true })
  const temporaryFile = `${userFile}.${randomUUID()}.tmp`
  await writeFile(temporaryFile, JSON.stringify(users, null, 2), "utf8")
  await rename(temporaryFile, userFile)
}

async function hashPassword(password: string, salt: string) {
  const derived = await scrypt(password, salt, 64) as Buffer
  return derived.toString("base64url")
}

export async function authenticateUser(email: string, password: string) {
  const user = users.find((item) => item.email === email.trim().toLocaleLowerCase())
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
  if (users.some((user) => user.email === normalizedEmail)) throw new Error("A user with this email already exists.")
  const passwordSalt = randomBytes(16).toString("base64url")
  const user: UserRecord = {
    userId: randomUUID(),
    email: normalizedEmail,
    name: name.trim(),
    role,
    passwordSalt,
    passwordHash: await hashPassword(password, passwordSalt),
  }
  users = [...users, user]
  await persistUsers()
  return user
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