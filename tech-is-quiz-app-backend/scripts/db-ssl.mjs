// Decide whether to use SSL for a PostgreSQL connection.
// Supabase (direct *.supabase.co and pooler *.supabase.com hosts) needs SSL.
// Override with DATABASE_SSL=true or DATABASE_SSL=false.
export function sslFor(databaseUrl) {
  const mode = process.env.DATABASE_SSL
  if (mode === "false") return undefined
  const host = new URL(databaseUrl).hostname
  if (mode === "true" || host.endsWith(".supabase.co") || host.endsWith(".supabase.com")) return { rejectUnauthorized: false }
  return undefined
}
