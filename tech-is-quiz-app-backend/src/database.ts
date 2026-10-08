import { Pool, type QueryResult, type QueryResultRow } from "pg"

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required. Add it to the backend environment before starting the API.")
}

const databaseHost = new URL(databaseUrl).hostname

export const pool = new Pool({
  connectionString: databaseUrl,
  ssl: databaseHost.endsWith(".supabase.co") ? { rejectUnauthorized: false } : undefined,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
})

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error:", error)
})

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params)
}

export async function withTransaction<T>(
  callback: (client: import("pg").PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    const result = await callback(client)
    await client.query("COMMIT")
    return result
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

export async function closeDatabase() {
  await pool.end()
}
