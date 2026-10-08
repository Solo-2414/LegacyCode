import "dotenv/config"
import pg from "pg"

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
try {
  const result = await pool.query(`
    SELECT
      (SELECT COUNT(*)::int FROM users) AS users,
      (SELECT COUNT(*)::int FROM quizzes) AS quizzes,
      (SELECT COUNT(*)::int FROM rounds) AS rounds,
      (SELECT COUNT(*)::int FROM questions) AS questions,
      (SELECT COUNT(*)::int FROM questions WHERE type = 'MULTIPLE_CHOICE') AS multiple_choice,
      (SELECT COUNT(*)::int FROM questions WHERE type = 'TRUE_FALSE') AS true_false,
      (SELECT COUNT(*)::int FROM questions WHERE type = 'IDENTIFICATION') AS identification
  `)
  console.log(JSON.stringify(result.rows[0], null, 2))
} finally {
  await pool.end()
}
