import { randomUUID } from "node:crypto"
import { query, withTransaction } from "./database.js"

type QuizQuestion = {
  id: string
  type: "MULTIPLE_CHOICE" | "TRUE_FALSE" | "IDENTIFICATION"
  questionText: string
  explanation?: string
  options: string[]
  correctOptions: number[]
  acceptedAnswers: string[]
  points: number
  timeLimitSec: number
}
type QuizRound = { id: string; title: string; questions: QuizQuestion[] }
export type Quiz = { id: string; title: string; description: string; partialCredit: boolean; rounds: QuizRound[]; updatedAt: string }

type QuizRow = {
  quiz_id: string
  quiz_title: string
  quiz_description: string | null
  quiz_partial_credit: boolean | null
  quiz_updated_at: Date
  round_id: string
  round_number: number
  round_title: string
  question_id: string
  question_type: QuizQuestion["type"]
  question_text: string
  explanation: string | null
  options: unknown
  correct_answer: unknown
  accepted_answers: unknown
  points: number
  time_limit_sec: number
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
}

function asNumberArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is number => typeof item === "number") : []
}

function asCorrectOptions(value: unknown, options: string[]) {
  const indexes = asNumberArray(value)
  if (indexes.length > 0) return indexes
  const scalar = typeof value === "boolean" ? String(value) : typeof value === "string" ? value : ""
  const normalized = scalar.trim().toLocaleLowerCase()
  if (!normalized) return []
  const index = options.findIndex((option) => option.trim().toLocaleLowerCase() === normalized)
  return index >= 0 ? [index] : []
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function normalizeQuiz(input: Quiz): Quiz {
  return {
    ...input,
    partialCredit: input.partialCredit === true,
    id: isUuid(input.id) ? input.id : randomUUID(),
    updatedAt: new Date().toISOString(),
    rounds: input.rounds.map((round) => ({
      ...round,
      id: isUuid(round.id) ? round.id : randomUUID(),
      questions: round.questions.map((question) => ({
        ...question,
        id: isUuid(question.id) ? question.id : randomUUID(),
      })),
    })),
  }
}

export async function loadQuizzes(): Promise<Quiz[]> {
  const result = await query<QuizRow>(`
    SELECT q.id AS quiz_id, q.title AS quiz_title, q.description AS quiz_description, q.partial_credit AS quiz_partial_credit, q.updated_at AS quiz_updated_at,
           r.id AS round_id, r.round_number, r.title AS round_title,
           question.id AS question_id, question.type AS question_type, question.question_text, question.explanation,
           question.options, question.correct_answer, question.accepted_answers,
           question.points, question.time_limit_sec
    FROM quizzes q
    LEFT JOIN rounds r ON r.quiz_id = q.id
    LEFT JOIN questions question ON question.round_id = r.id
    ORDER BY q.updated_at DESC, r.round_number ASC, question.id ASC
  `)
  const quizzes = new Map<string, Quiz>()
  const rounds = new Map<string, QuizRound>()
  for (const row of result.rows) {
    let quiz = quizzes.get(row.quiz_id)
    if (!quiz) {
      quiz = { id: row.quiz_id, title: row.quiz_title, description: row.quiz_description ?? "", partialCredit: row.quiz_partial_credit === true, rounds: [], updatedAt: row.quiz_updated_at.toISOString() }
      quizzes.set(row.quiz_id, quiz)
    }
    if (!row.round_id) continue
    let round = rounds.get(row.round_id)
    if (!round) {
      round = { id: row.round_id, title: row.round_title, questions: [] }
      rounds.set(row.round_id, round)
      quiz.rounds.push(round)
    }
    if (row.question_id) {
      round.questions.push({
        id: row.question_id,
        type: row.question_type,
        questionText: row.question_text,
        explanation: row.explanation ?? undefined,
        options: asStringArray(row.options),
        correctOptions: asCorrectOptions(row.correct_answer, asStringArray(row.options)),
        acceptedAnswers: asStringArray(row.accepted_answers),
        points: row.points,
        timeLimitSec: row.time_limit_sec,
      })
    }
  }
  return [...quizzes.values()]
}

export async function saveQuiz(input: Quiz, hostId: string): Promise<Quiz> {
  if (!isUuid(hostId)) throw new Error("The quiz host account ID is invalid.")
  const host = await query<{ id: string }>("SELECT id FROM users WHERE id = $1", [hostId])
  if (host.rowCount !== 1) throw new Error("The quiz host account could not be found.")
  const quiz = normalizeQuiz(input)
  await withTransaction(async (client) => {
    const updated = await client.query("UPDATE quizzes SET title = $2, description = $3, partial_credit = $5, updated_at = $4 WHERE id = $1", [quiz.id, quiz.title.trim(), quiz.description ?? "", quiz.updatedAt, quiz.partialCredit])
    if (!updated.rowCount) await client.query("INSERT INTO quizzes (id, host_id, title, description, partial_credit, updated_at) VALUES ($1, $2, $3, $4, $5, $6)", [quiz.id, hostId, quiz.title.trim(), quiz.description ?? "", quiz.partialCredit, quiz.updatedAt])
    await client.query("DELETE FROM rounds WHERE quiz_id = $1", [quiz.id])
    for (const [roundIndex, round] of quiz.rounds.entries()) {
      const roundId = round.id || randomUUID()
      await client.query("INSERT INTO rounds (id, quiz_id, round_number, title) VALUES ($1, $2, $3, $4)", [roundId, quiz.id, roundIndex + 1, round.title])
      for (const question of round.questions) {
        await client.query(
          "INSERT INTO questions (id, round_id, type, question_text, explanation, options, correct_answer, accepted_answers, points, time_limit_sec) VALUES ($1, $2, $3::question_type, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9, $10)",
          [question.id || randomUUID(), roundId, question.type, question.questionText, question.explanation?.trim() || null, JSON.stringify(question.options), JSON.stringify(question.correctOptions), JSON.stringify(question.acceptedAnswers), question.points, question.timeLimitSec],
        )
      }
    }
  })
  return quiz
}
