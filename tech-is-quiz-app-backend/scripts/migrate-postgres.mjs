import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import "dotenv/config"
import pg from "pg"

const { Pool } = pg
const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error("DATABASE_URL is required before running migrations.")
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: new URL(databaseUrl).hostname.endsWith(".supabase.co") ? { rejectUnauthorized: false } : undefined,
})

const scriptDirectory = resolve(fileURLToPath(new URL("..", import.meta.url)))
const migrationFiles = [
  resolve(scriptDirectory, "sql/001_create_postgres_schema.sql"),
  resolve(scriptDirectory, "sql/002_add_indexes_and_constraints.sql"),
]

try {
  for (const migrationFile of migrationFiles) {
    const sql = await readFile(migrationFile, "utf8")
    await pool.query(sql)
    console.log(`Applied ${migrationFile}`)
  }
  console.log("PostgreSQL schema migration completed.")
} finally {
  await pool.end()
}
