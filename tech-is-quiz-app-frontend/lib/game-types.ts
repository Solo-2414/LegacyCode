export type GamePhase = "LOBBY" | "QUESTION" | "REVEAL" | "LEADERBOARD" | "COMPLETED"

export type RoomPlayer = {
  id: string
  nickname: string
  teamName: string
  score: number
  isConnected: boolean
  hasAnswered: boolean
  answer?: string | number[]
  isCorrect?: boolean
  pointsAwarded?: number
}

export type LiveQuestion = {
  id: string
  type: "MULTIPLE_CHOICE" | "TRUE_FALSE" | "IDENTIFICATION"
  questionText: string
  explanation?: string
  options: string[]
  points: number
  timeLimitSec: number
  correctOptions?: number[]
  acceptedAnswers?: string[]
}

export type RoomState = {
  code: string
  quizTitle: string
  playerLimit: number | null
  autoStartWhenFull: boolean
  phase: GamePhase
  roundIndex: number
  questionIndex: number
  roundTitle: string
  questionCount: number
  isLastQuestion: boolean
  question: LiveQuestion | null
  teams: { name: string; playerCount: number }[]
  endsAt: number | null
  players: RoomPlayer[]
}

export type RoomSummary = {
  code: string
  quizId: string
  quizTitle: string
  playerLimit: number | null
  autoStartWhenFull: boolean
  phase: GamePhase
  playerCount: number
  createdAt: string
}