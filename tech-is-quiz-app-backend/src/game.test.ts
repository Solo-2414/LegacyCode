import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { applyAnswer, computeTeamStandings, everyoneConnectedAnswered, type AnswerablePlayer, type QuizQuestion } from "./game.js"

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

const trueFalseQuestion: QuizQuestion = {
  id: "q2",
  type: "TRUE_FALSE",
  questionText: "The statement is true.",
  options: ["True", "False"],
  correctOptions: [0],
  acceptedAnswers: [],
  points: 100,
  timeLimitSec: 30,
}

const multiQuestion: QuizQuestion = {
  id: "q3",
  type: "MULTIPLE_CHOICE",
  questionText: "Pick every JavaScript framework.",
  options: ["React", "Vue", "Django", "Rails"],
  correctOptions: [0, 1],
  acceptedAnswers: [],
  points: 100,
  timeLimitSec: 30,
}

describe("multiple-answer scoring", () => {
  const score = (answer: number[], partialCredit: boolean) => {
    const player: AnswerablePlayer = { score: 0 }
    const result = applyAnswer(player, multiQuestion, answer, 30_000, 30_000, { partialCredit })
    assert.equal(result.ok, true)
    return { result, player }
  }

  it("gives full points for the exact set in both modes", () => {
    for (const mode of [false, true]) {
      const { result, player } = score([1, 0], mode)
      assert.equal(result.isCorrect, true)
      assert.equal(result.isPartial, false)
      assert.equal(player.score, 100)
    }
  })

  it("strict mode: one correct + one wrong, or only one correct, scores 0", () => {
    for (const answer of [[0, 2], [0]]) {
      const { result, player } = score(answer, false)
      assert.equal(result.isCorrect, false)
      assert.equal(result.isPartial, false)
      assert.equal(player.score, 0)
    }
  })

  it("partial mode: only one correct answer earns half the points", () => {
    const { result, player } = score([0], true)
    assert.equal(result.isCorrect, false)
    assert.equal(result.isPartial, true)
    assert.equal(result.pointsAwarded, 50)
    assert.equal(player.score, 50)
  })

  it("partial mode: one correct + one wrong cancels out to 0", () => {
    const { result, player } = score([0, 2], true)
    assert.equal(result.isCorrect, false)
    assert.equal(result.isPartial, false)
    assert.equal(player.score, 0)
  })

  it("partial mode: selecting everything cannot beat the exact answer", () => {
    const { result, player } = score([0, 1, 2, 3], true)
    assert.equal(result.isCorrect, false)
    assert.equal(player.score, 0)
  })

  it("partial mode: only wrong picks score 0, never negative", () => {
    const { player } = score([2, 3], true)
    assert.equal(player.score, 0)
  })

  it("partial mode still includes the speed bonus, scaled by the fraction", () => {
    const player: AnswerablePlayer = { score: 0 }
    const result = applyAnswer(player, multiQuestion, [0], 0, 30_000, { partialCredit: true })
    assert.equal(result.ok && result.pointsAwarded, 60)
  })

  it("partial mode does not affect single-answer questions", () => {
    const player: AnswerablePlayer = { score: 0 }
    const result = applyAnswer(player, question, [1], 30_000, 30_000, { partialCredit: true })
    assert.equal(result.ok && result.pointsAwarded, 0)
  })
})

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

  it("scores True/False answers by normalized semantic value", () => {
    for (const answer of [[0], "true", "TRUE", true]) {
      const player: AnswerablePlayer = { score: 0 }
      const result = applyAnswer(player, trueFalseQuestion, answer, 30_000, 30_000)
      assert.equal(result.ok, true)
      assert.equal(result.isCorrect, true)
      assert.equal(player.score, 100)
    }
  })

  it("rejects the opposite normalized True/False value", () => {
    const player: AnswerablePlayer = { score: 0 }
    const result = applyAnswer(player, trueFalseQuestion, "false", 30_000, 30_000)
    assert.equal(result.ok, true)
    assert.equal(result.isCorrect, false)
    assert.equal(player.score, 0)
  })
})

describe("computeTeamStandings", () => {
  it("sums scores per team, ranks them, and averages per player", () => {
    const standings = computeTeamStandings([
      { teamName: "Blue", score: 300 },
      { teamName: "Blue", score: 100 },
      { teamName: "Red", score: 250 },
      { teamName: "Green", score: 250 },
    ])
    assert.deepEqual(standings.map((team) => team.name), ["Blue", "Green", "Red"])
    assert.deepEqual(standings[0], { name: "Blue", score: 400, playerCount: 2, average: 200 })
  })

  it("returns an empty list with no players", () => {
    assert.deepEqual(computeTeamStandings([]), [])
  })
})

describe("everyoneConnectedAnswered", () => {
  it("is true only when all connected players answered", () => {
    assert.equal(everyoneConnectedAnswered([{ isConnected: true, answer: [0] }, { isConnected: true, answer: [1] }]), true)
    assert.equal(everyoneConnectedAnswered([{ isConnected: true, answer: [0] }, { isConnected: true }]), false)
  })

  it("ignores disconnected players", () => {
    assert.equal(everyoneConnectedAnswered([{ isConnected: true, answer: [0] }, { isConnected: false }]), true)
  })

  it("is false when nobody is connected", () => {
    assert.equal(everyoneConnectedAnswered([]), false)
    assert.equal(everyoneConnectedAnswered([{ isConnected: false }]), false)
  })
})
