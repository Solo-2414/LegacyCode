import "dotenv/config"
import { randomBytes, randomUUID, scrypt as nodeScrypt } from "node:crypto"
import { promisify } from "node:util"
import pg from "pg"

const { Pool } = pg
const scrypt = promisify(nodeScrypt)
const email = process.env.SUPERADMIN_EMAIL?.trim().toLocaleLowerCase()
const name = process.env.SUPERADMIN_NAME?.trim() || "Platform Super Admin"
const password = process.env.SUPERADMIN_PASSWORD
if (!email || !password || password.length < 12) throw new Error("Set SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD (minimum 12 characters) before seeding.")

const salt = randomBytes(16).toString("base64url")
const passwordHash = (await scrypt(password, salt, 64)).toString("base64url")
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
try {
  const result = await pool.query(
    `INSERT INTO users (id, email, name, role, password_salt, password_hash)
     VALUES ($1, $2, $3, 'SUPERADMIN', $4, $5)
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, role = 'SUPERADMIN', password_salt = EXCLUDED.password_salt, password_hash = EXCLUDED.password_hash
     RETURNING id, email, name, role`,
    [randomUUID(), email, name, salt, passwordHash],
  )
  console.log(JSON.stringify({ seeded: true, user: result.rows[0] }, null, 2))
} finally {
  await pool.end()
}
