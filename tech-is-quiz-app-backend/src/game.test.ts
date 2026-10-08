import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { applyAnswer, type AnswerablePlayer, type QuizQuestion } from "./game.js"

const question: QuizQuestion = {
  id: "q1",
  type: "MULTIPLE_CHOICE",
  questionText: "Which language is used by Next.js?",
  options: ["JavaScript", "Python", "Ruby", "Go"],
  correctOptions: [0],
  acceptedAnswers: [],
  points: 100,
  timeLimitSec: 30,
}

describe("applyAnswer", () => {
  it("scores a correct answer using the remaining time", () => {
    const player: AnswerablePlayer = { score: 25 }
    const result = applyAnswer(player, question, [0], 20_000, 30_000)

    assert.equal(result.ok, true)
    assert.equal(result.isCorrect, true)
    assert.equal(result.pointsAwarded, 107)
    assert.equal(player.score, 132)
    assert.deepEqual(player.answer, [0])
  })

  it("locks an incorrect answer without awarding points", () => {
    const player: AnswerablePlayer = { score: 25 }
    const result = applyAnswer(player, question, [1], 20_000, 30_000)

    assert.equal(result.ok, true)
    assert.equal(result.isCorrect, false)
    assert.equal(result.pointsAwarded, 0)
    assert.equal(player.score, 25)
    assert.deepEqual(player.answer, [1])
  })

  it("rejects a duplicate answer without changing the score", () => {
    const player: AnswerablePlayer = { score: 25, answer: [0], isCorrect: true, pointsAwarded: 107 }
    const result = applyAnswer(player, question, [0], 20_000, 30_000)

    assert.equal(result.ok, false)
    assert.equal(result.error, "Your answer is already locked.")
    assert.equal(player.score, 25)
  })

  it("rejects an incorrect answer shape", () => {
    const player: AnswerablePlayer = { score: 25 }
    const result = applyAnswer(player, question, "not a valid answer", 20_000, 30_000)

    assert.equal(result.ok, false)
    assert.equal(result.error, "Your answer is invalid.")
    assert.equal(player.score, 25)
  })
})
