import type { SavedQuiz } from "@/components/pages/quiz-builder"
import type { RoomState, RoomSummary } from "@/lib/game-types"
import { clearApiToken, getApiToken } from "@/lib/api-token"

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4100"

/** fetch() against the API with the session token attached. Retries once with a fresh token on 401. */
export async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  async function send() {
    const token = await getApiToken().catch(() => "")
    return fetch(`${API_URL}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options?.headers },
      cache: "no-store",
      credentials: "include",
    })
  }
  const response = await send()
  if (response.status !== 401) return response
  clearApiToken()
  return send()
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await apiFetch(path, options)
  if (!response.ok) {
    const result = await response.json().catch(() => ({})) as { error?: string }
    throw new Error(result.error ?? `Request failed (${response.status}).`)
  }
  return response.json() as Promise<T>
}

export function getQuizzes() {
  return request<SavedQuiz[]>("/api/quizzes")
}

export function saveQuiz(quiz: SavedQuiz) {
  return request<SavedQuiz>("/api/quizzes", { method: "POST", body: JSON.stringify(quiz) })
}

export function getRooms() {
  return request<RoomSummary[]>("/api/rooms")
}

export function createRoom(quizId: string, settings: { playerLimit: number | null; autoStartWhenFull: boolean }) {
  return request<{ code: string; hostKey: string }>("/api/rooms", { method: "POST", body: JSON.stringify({ quizId, ...settings }) })
}

export function getRoom(code: string) {
  return request<RoomState>(`/api/rooms/${encodeURIComponent(code)}`)
}