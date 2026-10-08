import "dotenv/config"
import { randomUUID } from "node:crypto"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import pg from "pg"

const { Pool } = pg
const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)))
const data = path.join(root, "data")
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const isUuid = (value) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)

const users = JSON.parse(await readFile(path.join(data, "users.json"), "utf8"))
const quizzes = JSON.parse(await readFile(path.join(data, "quizzes.json"), "utf8"))
const client = await pool.connect()
try {
  await client.query("BEGIN")
  const admin = users.find((user) => user.role === "ADMIN")
  if (!admin) throw new Error("The JSON export must contain at least one ADMIN user.")

  for (const user of users) {
    await client.query(
      `INSERT INTO users (id, email, name, role, password_salt, password_hash)
       VALUES ($1, $2, $3, $4::user_role, $5, $6)
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role,
         password_salt = EXCLUDED.password_salt, password_hash = EXCLUDED.password_hash`,
      [isUuid(user.userId) ? user.userId : randomUUID(), user.email, user.name, user.role, user.passwordSalt, user.passwordHash],
    )
  }

  const adminRow = await client.query("SELECT id FROM users WHERE email = $1", [admin.email])
  for (const quiz of quizzes) {
    const quizId = isUuid(quiz.id) ? quiz.id : randomUUID()
    await client.query("INSERT INTO quizzes (id, host_id, title, description, updated_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description, updated_at = EXCLUDED.updated_at", [quizId, adminRow.rows[0].id, quiz.title, quiz.description ?? "", quiz.updatedAt ?? new Date().toISOString()])
    for (const [roundIndex, round] of (quiz.rounds ?? []).entries()) {
      const roundId = isUuid(round.id) ? round.id : randomUUID()
      await client.query("INSERT INTO rounds (id, quiz_id, round_number, title) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title", [roundId, quizId, roundIndex + 1, round.title])
      for (const question of round.questions ?? []) {
        const questionId = isUuid(question.id) ? question.id : randomUUID()
        await client.query("INSERT INTO questions (id, round_id, type, question_text, options, correct_answer, accepted_answers, points, time_limit_sec) VALUES ($1, $2, $3::question_type, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8, $9) ON CONFLICT (id) DO UPDATE SET question_text = EXCLUDED.question_text, options = EXCLUDED.options, correct_answer = EXCLUDED.correct_answer, accepted_answers = EXCLUDED.accepted_answers, points = EXCLUDED.points, time_limit_sec = EXCLUDED.time_limit_sec", [questionId, roundId, question.type, question.questionText, JSON.stringify(question.options ?? []), JSON.stringify(question.correctOptions ?? []), JSON.stringify(question.acceptedAnswers ?? []), question.points ?? 100, question.timeLimitSec ?? 30])
      }
    }
  }
  await client.query("COMMIT")
  console.log(`Imported ${users.length} users and ${quizzes.length} quizzes into PostgreSQL.`)
} catch (error) {
  await client.query("ROLLBACK")
  throw error
} finally {
  client.release()
  await pool.end()
}
