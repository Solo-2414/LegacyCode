import { io, type Socket } from "socket.io-client"
import { API_URL } from "@/lib/quiz-api"
import type { RoomState, RoomSummary } from "@/lib/game-types"

type ServerEvents = {
  "room:state": (state: RoomState) => void
  "room:created": (room: RoomSummary) => void
  "room:updated": (room: RoomSummary) => void
  "room:team-changed": (update: { teamName: string; players: Array<{ id: string; nickname: string; teamName: string; isConnected: boolean }> }) => void
  "room:team-created": (team: { name: string; playerCount: number }) => void
}

type ClientEvents = {
  "room:watch": (payload: { code: string }, acknowledge: (result: { ok: boolean; error?: string }) => void) => void
  "room:join": (payload: { code: string; role?: "host"; hostKey?: string; participantId?: string; playerId?: string; nickname?: string; teamName?: string }, acknowledge: (result: { ok: boolean; error?: string; participantId?: string; teamId?: string }) => void) => void
  "room:start": (payload: { code: string }) => void
  "room:reveal": (payload: { code: string }) => void
  "room:leaderboard": (payload: { code: string }) => void
  "room:next": (payload: { code: string }) => void
  "room:submit": (payload: { code: string; playerId: string; participantId?: string; teamId?: string; answer: string | number[] }, acknowledge: (result: { ok: boolean; error?: string; isCorrect?: boolean; pointsAwarded?: number }) => void) => void
}

let socket: Socket<ServerEvents, ClientEvents> | undefined

export function getRealtimeSocket() {
  socket ??= io(API_URL, { autoConnect: false, reconnection: true, withCredentials: true })
  return socket
}