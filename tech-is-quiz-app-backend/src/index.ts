import "dotenv/config"
import cors from "cors"
import express, { type Request, type Response } from "express"
import { createServer } from "node:http"
import { randomInt, randomUUID } from "node:crypto"
import { Server, type Socket } from "socket.io"
import { authenticateUser, createSessionToken, loadUsers, validateAuthConfiguration, verifySessionToken, type SessionUser, type UserRole } from "./auth.js"
import { applyAnswer } from "./game.js"
import { query } from "./database.js"
import { loadQuizzes, saveQuiz, type Quiz } from "./quiz-store.js"
import { normalizeNickname, validateNickname, validateTeamName, validateTeamNameInput } from "./room-validation.js"

type QuizQuestion = {
  id: string
  type: "MULTIPLE_CHOICE" | "TRUE_FALSE" | "IDENTIFICATION"
  questionText: string
  options: string[]
  correctOptions: number[]
  acceptedAnswers: string[]
  points: number
  timeLimitSec: number
}
type QuizRound = { id: string; title: string; questions: QuizQuestion[] }
type Player = {
  id: string
  participantId?: string
  nickname: string
  teamName: string
  score: number
  isConnected: boolean
  socketId: string
  answer?: string | number[]
  pointsAwarded?: number
  isCorrect?: boolean
}
type GamePhase = "LOBBY" | "QUESTION" | "REVEAL" | "LEADERBOARD" | "COMPLETED"
type Room = {
  id: string
  code: string
  hostKey: string
  hostId: string
  quiz: Quiz
  playerLimit: number | null
  autoStartWhenFull: boolean
  phase: GamePhase
  roundIndex: number
  questionIndex: number
  players: Map<string, Player>
  createdAt: string
  startedAt: number | null
  endsAt: number | null
  timer: ReturnType<typeof setTimeout> | null
  hostSocketId?: string
}
  type ClientSocket = Socket & { data: { role?: "host" | "player"; appRole?: UserRole; userId?: string; roomCode?: string; playerId?: string } }

const app = express()
const server = createServer(app)
const frontendOrigin = process.env.FRONTEND_URL ?? "http://localhost:3000"
const allowedOrigins = [frontendOrigin, "http://127.0.0.1:3000"]
const io = new Server(server, { cors: { origin: allowedOrigins, credentials: true } })
const rooms = new Map<string, Room>()
let quizzes: Quiz[] = []

app.use(cors({ origin: allowedOrigins, credentials: true }))
app.use(express.json({ limit: "1mb" }))

function tokenFromCookie(cookieHeader: string | undefined) {
  const sessionCookie = cookieHeader?.split(";").map((part) => part.trim()).find((part) => part.startsWith("techis_session="))
  if (!sessionCookie) return ""
  try {
    return decodeURIComponent(sessionCookie.slice("techis_session=".length))
  } catch {
    return ""
  }
}

async function requireRole(request: Request, response: Response, role: UserRole) {
  const session = await verifySessionToken(tokenFromCookie(request.headers.cookie))
  if (!session) {
    response.status(401).json({ error: "Authentication required." })
    return null
  }
  if (session.role !== role) {
    response.status(403).json({ error: "This account does not have access to this resource." })
    return null
  }
  return session
}

const loginAttempts = new Map<string, { count: number; resetAt: number }>()
const maxLoginAttempts = 5
const loginWindowMs = 15 * 60 * 1000

app.post("/auth/login", async (request, response) => {
  const origin = request.headers.origin
  if (origin && !allowedOrigins.includes(origin)) {
    response.status(403).json({ error: "Origin is not allowed." })
    return
  }
  const address = request.ip ?? "unknown"
  const attempt = loginAttempts.get(address)
  if (attempt && attempt.resetAt > Date.now() && attempt.count >= maxLoginAttempts) {
    response.status(429).json({ error: "Too many sign-in attempts. Try again in 15 minutes." })
    return
  }
  const email = typeof request.body?.email === "string" ? request.body.email : ""
  const password = typeof request.body?.password === "string" ? request.body.password : ""
  const user = await authenticateUser(email, password)
  if (!user) {
    const nextAttempt = attempt && attempt.resetAt > Date.now() ? attempt : { count: 0, resetAt: Date.now() + loginWindowMs }
    nextAttempt.count += 1
    loginAttempts.set(address, nextAttempt)
    response.status(401).json({ error: "Email or password is incorrect." })
    return
  }
  loginAttempts.delete(address)
  const token = await createSessionToken(user)
  response.json({ token, session: { userId: user.userId, name: user.name, role: user.role } satisfies SessionUser })
})

function currentQuestion(room: Room) {
  return room.quiz.rounds[room.roundIndex]?.questions[room.questionIndex]
}

function roomState(room: Room) {
  const reveal = room.phase === "REVEAL" || room.phase === "LEADERBOARD" || room.phase === "COMPLETED"
  const question = currentQuestion(room)
  const teamSizes = new Map<string, number>()
  for (const player of room.players.values()) teamSizes.set(player.teamName, (teamSizes.get(player.teamName) ?? 0) + 1)
  return {
    code: room.code,
    quizTitle: room.quiz.title,
    playerLimit: room.playerLimit,
    autoStartWhenFull: room.autoStartWhenFull,
    phase: room.phase,
    roundIndex: room.roundIndex,
    questionIndex: room.questionIndex,
    roundTitle: room.quiz.rounds[room.roundIndex]?.title ?? "",
    questionCount: room.quiz.rounds.reduce((total, round) => total + round.questions.length, 0),
    isLastQuestion: room.roundIndex === room.quiz.rounds.length - 1 && room.questionIndex === (room.quiz.rounds[room.roundIndex]?.questions.length ?? 0) - 1,
    question: question ? {
      id: question.id,
      type: question.type,
      questionText: question.questionText,
      options: question.options,
      points: question.points,
      timeLimitSec: question.timeLimitSec,
      ...(reveal ? { correctOptions: question.correctOptions, acceptedAnswers: question.acceptedAnswers } : {}),
    } : null,
    teams: [...teamSizes].map(([name, playerCount]) => ({ name, playerCount })).sort((first, second) => first.name.localeCompare(second.name)),
    endsAt: room.phase === "QUESTION" ? room.endsAt : null,
    players: [...room.players.values()].map((player) => ({
      id: player.id,
      nickname: player.nickname,
      teamName: player.teamName,
      score: player.score,
      isConnected: player.isConnected,
      hasAnswered: player.answer !== undefined,
      ...(reveal && player.answer !== undefined ? {
        answer: player.answer,
        isCorrect: player.isCorrect,
        pointsAwarded: player.pointsAwarded,
      } : {}),
    })).sort((first, second) => second.score - first.score || first.nickname.localeCompare(second.nickname)),
  }
}

function broadcastRoom(room: Room) {
  const state = roomState(room)
  io.to(room.code).emit("room:state", state)
  io.emit("room:updated", roomSummary(room))
}

function setPhase(room: Room, phase: GamePhase) {
  if (room.timer) clearTimeout(room.timer)
  room.timer = null
  room.endsAt = null
  room.phase = phase
  if (phase === "QUESTION") {
    const question = currentQuestion(room)
    if (!question) return finishRoom(room)
    for (const player of room.players.values()) {
      delete player.answer
      delete player.pointsAwarded
      delete player.isCorrect
    }
    room.startedAt = Date.now()
    room.endsAt = room.startedAt + question.timeLimitSec * 1000
    room.timer = setTimeout(() => {
      if (room.phase === "QUESTION") setPhase(room, "REVEAL")
    }, question.timeLimitSec * 1000)
  }
  void updatePersistedRoom(room).catch((error) => console.error("Could not persist room phase:", error))
  broadcastRoom(room)
}

function finishRoom(room: Room) {
  if (room.timer) clearTimeout(room.timer)
  room.timer = null
  room.endsAt = null
  room.phase = "COMPLETED"
  void updatePersistedRoom(room).catch((error) => console.error("Could not persist completed room:", error))
  broadcastRoom(room)
}

function findRoom(code: unknown): Room | undefined {
  return typeof code === "string" ? rooms.get(code) : undefined
}

function roomSummary(room: Room) {
  return {
    code: room.code,
    quizId: room.quiz.id,
    quizTitle: room.quiz.title,
    playerLimit: room.playerLimit,
    autoStartWhenFull: room.autoStartWhenFull,
    phase: room.phase,
    playerCount: room.players.size,
    createdAt: room.createdAt,
  }
}

async function persistRoom(room: Room) {
  await query(
    "INSERT INTO rooms (id, room_code, host_key, quiz_id, host_id, status, player_limit, auto_start_when_full, phase, round_index, question_index, started_at, ends_at, created_at) VALUES ($1, $2, $3, $4, $5, $6::room_status, $7, $8, $9, $10, $11, $12, $13, $14)",
    [room.id, room.code, room.hostKey, room.quiz.id, room.hostId, room.phase === "LOBBY" ? "LOBBY" : room.phase === "COMPLETED" ? "COMPLETED" : "IN_PROGRESS", room.playerLimit, room.autoStartWhenFull, room.phase === "LOBBY" ? 0 : room.phase === "QUESTION" ? 1 : room.phase === "REVEAL" ? 2 : room.phase === "LEADERBOARD" ? 3 : 4, room.roundIndex, room.questionIndex, room.startedAt ? new Date(room.startedAt) : null, room.endsAt ? new Date(room.endsAt) : null, room.createdAt],
  )
}

async function persistPlayer(room: Room, player: Player) {
  const teamResult = await query<{ id: string }>("INSERT INTO teams (room_id, name) VALUES ($1, $2) ON CONFLICT (room_id, name) DO UPDATE SET name = EXCLUDED.name RETURNING id", [room.id, player.teamName])
  const teamId = teamResult.rows[0].id
  const participantResult = await query<{ id: string }>("INSERT INTO participants (room_id, team_id, user_id, nickname, score, is_connected) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (room_id, user_id) DO UPDATE SET team_id = EXCLUDED.team_id, nickname = EXCLUDED.nickname, score = EXCLUDED.score, is_connected = EXCLUDED.is_connected RETURNING id", [room.id, teamId, player.id, player.nickname, player.score, player.isConnected])
  player.participantId = participantResult.rows[0].id
}

async function updatePersistedRoom(room: Room) {
  await query("UPDATE rooms SET status = $2::room_status, phase = $3, round_index = $4, question_index = $5, started_at = $6, ends_at = $7, updated_at = CURRENT_TIMESTAMP WHERE id = $1", [room.id, room.phase === "LOBBY" ? "LOBBY" : room.phase === "COMPLETED" ? "COMPLETED" : "IN_PROGRESS", room.phase === "LOBBY" ? 0 : room.phase === "QUESTION" ? 1 : room.phase === "REVEAL" ? 2 : room.phase === "LEADERBOARD" ? 3 : 4, room.roundIndex, room.questionIndex, room.startedAt ? new Date(room.startedAt) : null, room.endsAt ? new Date(room.endsAt) : null])
}

function isHost(socket: ClientSocket, room: Room) {
  return socket.data.role === "host" && socket.data.roomCode === room.code
}

app.get("/health", (_request, response) => response.json({ status: "ok" }))
app.get("/api/quizzes", async (request, response) => {
  if (!await requireRole(request, response, "ADMIN")) return
  response.json(quizzes)
})
app.post("/api/quizzes", async (request, response) => {
  const session = await requireRole(request, response, "ADMIN")
  if (!session) return
  const quiz = request.body as Quiz
  if (!quiz?.title?.trim() || !Array.isArray(quiz.rounds) || quiz.rounds.length === 0) {
    response.status(400).json({ error: "A quiz title and at least one round are required." })
    return
  }
  const savedQuiz = await saveQuiz({ ...quiz, title: quiz.title.trim() }, session.userId)
  quizzes = await loadQuizzes()
  response.status(200).json(savedQuiz)
})

app.get("/api/rooms", async (request, response) => {
  if (!await requireRole(request, response, "ADMIN")) return
  response.json([...rooms.values()].map((room) => ({
    code: room.code,
    quizId: room.quiz.id,
    quizTitle: room.quiz.title,
    playerLimit: room.playerLimit,
    autoStartWhenFull: room.autoStartWhenFull,
    phase: room.phase,
    playerCount: room.players.size,
    createdAt: room.createdAt,
  })))
})
app.post("/api/rooms", async (request, response) => {
  const session = await requireRole(request, response, "ADMIN")
  if (!session) return
  const playerLimit = request.body?.playerLimit ?? null
  const autoStartWhenFull = request.body?.autoStartWhenFull ?? false
  if (playerLimit !== null && (!Number.isInteger(playerLimit) || playerLimit < 2 || playerLimit > 500)) {
    response.status(400).json({ error: "Player limit must be between 2 and 500." })
    return
  }
  if (typeof autoStartWhenFull !== "boolean" || (autoStartWhenFull && playerLimit === null)) {
    response.status(400).json({ error: "Auto-start requires a player limit." })
    return
  }
  const quiz = quizzes.find((item) => item.id === request.body?.quizId)
  if (!quiz) {
    response.status(404).json({ error: "Quiz not found." })
    return
  }
  let code = String(randomInt(100000, 1000000))
  while (rooms.has(code)) code = String(randomInt(100000, 1000000))
  const room: Room = {
    id: randomUUID(),
    code,
    hostKey: randomUUID(),
    hostId: session.userId,
    quiz,
    playerLimit,
    autoStartWhenFull,
    phase: "LOBBY",
    roundIndex: 0,
    questionIndex: 0,
    players: new Map(),
    createdAt: new Date().toISOString(),
    startedAt: null,
    endsAt: null,
    timer: null,
  }
  await persistRoom(room)
  rooms.set(code, room)
  io.emit("room:created", roomSummary(room))
  response.status(201).json({ code, hostKey: room.hostKey })
})
app.get("/api/rooms/:code", async (request, response) => {
  if (!await requireRole(request, response, "PARTICIPANT")) return
  const room = findRoom(request.params.code)
  if (!room) {
    response.status(404).json({ error: "Room not found." })
    return
  }
  response.json(roomState(room))
})

io.use((rawSocket, next) => {
  const socket = rawSocket as ClientSocket
  void verifySessionToken(tokenFromCookie(socket.handshake.headers.cookie)).then((session) => {
    if (!session) {
      next(new Error("Authentication required."))
      return
    }
    socket.data.userId = session.userId
    socket.data.appRole = session.role
    next()
  }).catch(() => next(new Error("Authentication required.")))
})

io.on("connection", (rawSocket) => {
  const socket = rawSocket as ClientSocket

  socket.on("room:watch", (payload: { code?: string }, acknowledge?: (result: { ok: boolean; error?: string }) => void) => {
    if (socket.data.appRole !== "PARTICIPANT") return acknowledge?.({ ok: false, error: "Participant account required." })
    const room = findRoom(payload?.code)
    if (!room) return acknowledge?.({ ok: false, error: "Room not found." })
    void socket.join(room.code)
    acknowledge?.({ ok: true })
    socket.emit("room:state", roomState(room))
  })

  socket.on("room:join", async (payload: { code?: string; role?: string; hostKey?: string; playerId?: string; nickname?: string; teamName?: string }, acknowledge?: (result: { ok: boolean; error?: string }) => void) => {
    const room = findRoom(payload?.code)
    if (!room) return acknowledge?.({ ok: false, error: "Room not found. Check the six-digit code." })
    if (payload.role === "host") {
      if (socket.data.appRole !== "ADMIN") return acknowledge?.({ ok: false, error: "Admin account required." })
      if (payload.hostKey !== room.hostKey) return acknowledge?.({ ok: false, error: "Host access is invalid. Reopen this room from the dashboard." })
      socket.data.role = "host"
      socket.data.roomCode = room.code
      room.hostSocketId = socket.id
    } else {
      if (socket.data.appRole !== "PARTICIPANT") return acknowledge?.({ ok: false, error: "Participant account required." })
      if (room.phase === "COMPLETED") return acknowledge?.({ ok: false, error: "This quiz has already ended." })
      const playerId = socket.data.userId
      if (!playerId) return acknowledge?.({ ok: false, error: "Session user is missing." })
      const existing = room.players.get(playerId)
      if (!existing && room.playerLimit !== null && room.players.size >= room.playerLimit) {
        return acknowledge?.({ ok: false, error: "This room is full." })
      }
      const nickname = normalizeNickname(payload.nickname ?? "")
      const nicknameError = validateNickname(payload.nickname ?? "")
      if (nicknameError) return acknowledge?.({ ok: false, error: nicknameError })
      const teamName = validateTeamName(payload.teamName ?? "") || existing?.teamName
      const teamNameError = validateTeamNameInput(payload.teamName ?? "")
      if (!teamName || (!existing && teamNameError)) return acknowledge?.({ ok: false, error: teamNameError ?? "Choose a team to join." })
      const nameTaken = [...room.players.values()].some((player) => player.id !== playerId && player.nickname.toLocaleLowerCase() === nickname.toLocaleLowerCase())
      if (nameTaken) return acknowledge?.({ ok: false, error: "That nickname is already in this room." })
      room.players.set(playerId, {
        id: playerId,
        nickname,
        teamName,
        score: existing?.score ?? 0,
        isConnected: true,
        socketId: socket.id,
        answer: existing?.answer,
        pointsAwarded: existing?.pointsAwarded,
        isCorrect: existing?.isCorrect,
      })
      await persistPlayer(room, room.players.get(playerId)!)
      socket.data.role = "player"
      socket.data.playerId = playerId
      socket.data.roomCode = room.code
    }
    await socket.join(room.code)
    if (socket.data.role === "player") {
      io.to(room.code).emit("room:team-changed", {
        teamName: room.players.get(socket.data.playerId!)?.teamName ?? "",
        players: [...room.players.values()].map((player) => ({ id: player.id, nickname: player.nickname, teamName: player.teamName, isConnected: player.isConnected })),
      })
    }
    acknowledge?.({ ok: true })
    if (socket.data.role === "player" && room.phase === "LOBBY" && room.autoStartWhenFull && room.playerLimit !== null && room.players.size >= room.playerLimit) {
      setPhase(room, "QUESTION")
    } else {
      void updatePersistedRoom(room).catch((error) => console.error("Could not persist room update:", error))
      broadcastRoom(room)
    }
  })

  socket.on("room:start", (payload: { code?: string }) => {
    const room = findRoom(payload?.code)
    if (room && isHost(socket, room) && room.phase === "LOBBY") setPhase(room, "QUESTION")
  })
  socket.on("room:reveal", (payload: { code?: string }) => {
    const room = findRoom(payload?.code)
    if (room && isHost(socket, room) && room.phase === "QUESTION") setPhase(room, "REVEAL")
  })
  socket.on("room:leaderboard", (payload: { code?: string }) => {
    const room = findRoom(payload?.code)
    if (room && isHost(socket, room) && room.phase === "REVEAL") setPhase(room, "LEADERBOARD")
  })
  socket.on("room:next", (payload: { code?: string }) => {
    const room = findRoom(payload?.code)
    if (!room || !isHost(socket, room) || room.phase !== "LEADERBOARD") return
    const round = room.quiz.rounds[room.roundIndex]
    if (round && room.questionIndex + 1 < round.questions.length) {
      room.questionIndex += 1
      setPhase(room, "QUESTION")
      return
    }
    if (room.roundIndex + 1 < room.quiz.rounds.length) {
      room.roundIndex += 1
      room.questionIndex = 0
      setPhase(room, "QUESTION")
      return
    }
    finishRoom(room)
  })
  socket.on("room:submit", (payload: { code?: string; playerId?: string; answer?: unknown }, acknowledge?: (result: { ok: boolean; error?: string; isCorrect?: boolean; pointsAwarded?: number }) => void) => {
    const room = findRoom(payload?.code)
    const player = room?.players.get(socket.data.playerId ?? "")
    const question = room ? currentQuestion(room) : undefined
    if (!room || !player || player.socketId !== socket.id || socket.data.role !== "player" || socket.data.appRole !== "PARTICIPANT") return acknowledge?.({ ok: false, error: "Player session not found." })
    if (room.phase !== "QUESTION" || !question || !room.startedAt || !room.endsAt || Date.now() > room.endsAt) return acknowledge?.({ ok: false, error: "Answers are locked." })
    const duration = question.timeLimitSec * 1000
    const elapsed = Math.max(0, Date.now() - room.startedAt)
    const result = applyAnswer(player, question, payload.answer, elapsed, duration)
    if (!result.ok) return acknowledge?.(result)
    acknowledge?.(result)
    void query("UPDATE participants SET score = $2, is_connected = TRUE WHERE id = $1", [player.participantId, player.score]).catch((error) => console.error("Could not persist participant score:", error))
    void query("UPDATE teams SET total_score = (SELECT COALESCE(SUM(score), 0) FROM participants WHERE team_id = teams.id) WHERE id = (SELECT team_id FROM participants WHERE id = $1)", [player.participantId]).catch((error) => console.error("Could not persist team score:", error))
    void query("INSERT INTO submissions (team_id, question_id, participant_id, submitted_answer, is_correct, points_awarded) SELECT team_id, $2, id, $3::jsonb, $4, $5 FROM participants WHERE id = $1 ON CONFLICT (participant_id, question_id) DO UPDATE SET submitted_answer = EXCLUDED.submitted_answer, is_correct = EXCLUDED.is_correct, points_awarded = EXCLUDED.points_awarded", [player.participantId, question.id, JSON.stringify(payload.answer), result.isCorrect, result.pointsAwarded ?? 0]).catch((error) => console.error("Could not persist submission:", error))
    broadcastRoom(room)
  })

  socket.on("disconnect", () => {
    const room = findRoom(socket.data.roomCode)
    if (!room) return
    if (room.hostSocketId === socket.id) room.hostSocketId = undefined
    const player = room.players.get(socket.data.playerId ?? "")
    if (player?.socketId === socket.id) {
      player.isConnected = false
      void query("UPDATE participants SET is_connected = FALSE WHERE id = $1", [player.participantId]).catch((error) => console.error("Could not persist disconnect:", error))
      broadcastRoom(room)
    }
  })
})

const port = Number(process.env.PORT ?? 4100)
validateAuthConfiguration()
await loadQuizzes().then((loadedQuizzes) => { quizzes = loadedQuizzes })
await loadUsers()
server.listen(port, () => console.log(`TechIs Quiz API and Socket.IO listening on http://localhost:${port}`))