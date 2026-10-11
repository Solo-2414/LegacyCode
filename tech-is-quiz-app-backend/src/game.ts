export type QuizQuestion = {
  id: string
  type: "MULTIPLE_CHOICE" | "TRUE_FALSE" | "IDENTIFICATION"
  questionText: string
  options: string[]
  correctOptions: number[]
  acceptedAnswers: string[]
  points: number
  timeLimitSec: number
}

export type AnswerablePlayer = {
  score: number
  answer?: string | number[] | boolean
  isCorrect?: boolean
  isPartial?: boolean
  pointsAwarded?: number
}

export type AnswerResult =
  | { ok: true; isCorrect: boolean; isPartial: boolean; pointsAwarded: number }
  | { ok: false; error: string }

export function checkAnswer(question: QuizQuestion, answer: unknown): boolean {
  if (question.type === "IDENTIFICATION") {
    if (typeof answer !== "string") return false
    const normalized = answer.trim().toLocaleLowerCase()
    return question.acceptedAnswers.some((accepted) => accepted.trim().toLocaleLowerCase() === normalized)
  }

  if (question.type === "TRUE_FALSE") {
    const submitted = normalizeTrueFalseAnswer(question, answer)
    const correctIndex = question.correctOptions[0]
    const correct = typeof correctIndex === "number" ? normalizeTrueFalseAnswer(question, [correctIndex]) : normalizeTrueFalseValue(question.acceptedAnswers[0])
    return submitted !== undefined && correct !== undefined && submitted === correct
  }

  if (!Array.isArray(answer) || !answer.every((choice) => Number.isInteger(choice))) return false
  const submitted = [...new Set(answer)].sort((first, second) => first - second)
  const correct = [...question.correctOptions].sort((first, second) => first - second)
  return submitted.length === correct.length && submitted.every((choice, index) => choice === correct[index])
}

export type ScoringOptions = { partialCredit?: boolean }

/**
 * Share of the points earned on a multiple-answer question when partial credit is on:
 * (correct picks - wrong picks) / total correct answers, never below 0.
 * Example with 2 correct answers: both = 1, one correct only = 0.5, one correct + one wrong = 0.
 */
export function partialCreditFraction(question: QuizQuestion, answer: unknown): number {
  if (question.type !== "MULTIPLE_CHOICE" || question.correctOptions.length < 2) return 0
  if (!Array.isArray(answer) || !answer.every((choice) => Number.isInteger(choice))) return 0
  const correct = new Set(question.correctOptions)
  const picked = [...new Set(answer as number[])]
  const rightPicks = picked.filter((choice) => correct.has(choice)).length
  const wrongPicks = picked.length - rightPicks
  return Math.max(0, (rightPicks - wrongPicks) / correct.size)
}

export function applyAnswer(
  player: AnswerablePlayer,
  question: QuizQuestion,
  answer: unknown,
  elapsedMs: number,
  totalDurationMs: number,
  options: ScoringOptions = {},
): AnswerResult {
  if (player.answer !== undefined) return { ok: false, error: "Your answer is already locked." }
  if (!isValidAnswerShape(question, answer)) return { ok: false, error: "Your answer is invalid." }

  const isCorrect = checkAnswer(question, answer)
  const remaining = Math.max(0, Math.min(totalDurationMs, totalDurationMs - elapsedMs))
  const fullPoints = question.points + Math.round(question.points * 0.2 * remaining / totalDurationMs)
  const fraction = isCorrect ? 1 : options.partialCredit ? partialCreditFraction(question, answer) : 0
  const pointsAwarded = isCorrect ? fullPoints : Math.round(fullPoints * fraction)
  const isPartial = !isCorrect && pointsAwarded > 0
  player.answer = answer as string | number[] | boolean
  player.isCorrect = isCorrect
  player.isPartial = isPartial
  player.pointsAwarded = pointsAwarded
  player.score += pointsAwarded

  return { ok: true, isCorrect, isPartial, pointsAwarded }
}

function isValidAnswerShape(question: QuizQuestion, answer: unknown): boolean {
  if (question.type === "IDENTIFICATION") return typeof answer === "string"
  if (question.type === "TRUE_FALSE") {
    if (typeof answer === "boolean" || typeof answer === "string") return normalizeTrueFalseAnswer(question, answer) !== undefined
    return Array.isArray(answer) && answer.length === 1 && Number.isInteger(answer[0]) && normalizeTrueFalseAnswer(question, answer) !== undefined
  }
  if (!Array.isArray(answer)) return false
  return answer.every((choice) => Number.isInteger(choice))
}

function normalizeTrueFalseAnswer(question: QuizQuestion, answer: unknown): string | undefined {
  let value: unknown = answer
  if (Array.isArray(answer)) value = answer.length === 1 && Number.isInteger(answer[0]) ? question.options[answer[0]] : undefined
  return normalizeTrueFalseValue(value)
}

function normalizeTrueFalseValue(value: unknown): string | undefined {
  if (typeof value === "boolean") return value ? "true" : "false"
  if (value === undefined || value === null) return undefined
  const normalized = String(value).trim().toLocaleLowerCase()
  if (normalized === "true" || normalized === "false") return normalized
  return undefined
}
