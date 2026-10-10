"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRight, CalendarDays, Check, CirclePlay, Copy, Pencil, Plus, Radio, UsersRound, X } from "lucide-react"
import { PageHeading, QuizShell, primaryButtonClass, secondaryButtonClass, surfaceClass } from "@/components/quiz-shell"
import { QuizBuilder, type SavedQuiz } from "@/components/pages/quiz-builder"
import { createRoom, getQuizzes, getRooms, saveQuiz as saveQuizRequest } from "@/lib/quiz-api"
import { getRealtimeSocket } from "@/lib/realtime"
import type { RoomSummary } from "@/lib/game-types"

export function AdminDashboard() {
  const router = useRouter()
  const [rooms, setRooms] = useState<RoomSummary[]>([])
  const [copiedCode, setCopiedCode] = useState("")
  const [copiedPlayerLinkCode, setCopiedPlayerLinkCode] = useState("")
  const [quizzes, setQuizzes] = useState<SavedQuiz[]>([])
  const [editingQuiz, setEditingQuiz] = useState<SavedQuiz | null>(null)
  const [isCreatingQuiz, setIsCreatingQuiz] = useState(false)
  const [roomSetupQuiz, setRoomSetupQuiz] = useState<SavedQuiz | null>(null)
  const [playerLimitInput, setPlayerLimitInput] = useState("")
  const [autoStartWhenFull, setAutoStartWhenFull] = useState(false)
  const [isCreatingRoom, setIsCreatingRoom] = useState(false)
  const [serviceError, setServiceError] = useState("")

  useEffect(() => {
    Promise.all([getQuizzes(), getRooms()]).then(([savedQuizzes, savedRooms]) => {
      setQuizzes(savedQuizzes)
      setRooms(savedRooms)
    }).catch((error: unknown) => setServiceError(error instanceof Error ? error.message : "Could not reach the quiz service."))

    const socket = getRealtimeSocket()
    const updateRoom = (updatedRoom: RoomSummary) => {
      setRooms((currentRooms) => {
        const exists = currentRooms.some((room) => room.code === updatedRoom.code)
        return exists
          ? currentRooms.map((room) => room.code === updatedRoom.code ? updatedRoom : room)
          : [updatedRoom, ...currentRooms]
      })
    }
    socket.on("room:created", updateRoom)
    socket.on("room:updated", updateRoom)
    socket.connect()
    return () => {
      socket.off("room:created", updateRoom)
      socket.off("room:updated", updateRoom)
    }
  }, [])

  async function saveQuiz(quiz: SavedQuiz) {
    try {
      const saved = await saveQuizRequest(quiz)
      const updated = [saved, ...quizzes.filter((item) => item.id !== saved.id)]
      setQuizzes(updated)
      setServiceError("")
      setEditingQuiz(null)
      setIsCreatingQuiz(false)
    } catch (error) {
      setServiceError(error instanceof Error ? error.message : "Could not save the quiz.")
    }
  }

  async function createRoomForQuiz(quiz: SavedQuiz) {
    setIsCreatingRoom(true)
    try {
      const room = await createRoom(quiz.id, {
        playerLimit: playerLimitInput ? Number(playerLimitInput) : null,
        autoStartWhenFull,
      })
      window.sessionStorage.setItem(`techis-host:${room.code}`, room.hostKey)
      setRoomSetupQuiz(null)
      router.push(`/room/${room.code}/host`)
    } catch (error) {
      setServiceError(error instanceof Error ? error.message : "Could not create the room.")
    } finally {
      setIsCreatingRoom(false)
    }
  }

  function openRoomSettings(quiz: SavedQuiz) {
    setPlayerLimitInput("")
    setAutoStartWhenFull(false)
    setRoomSetupQuiz(quiz)
  }

  async function refreshRooms() {
    try {
      setRooms(await getRooms())
      setServiceError("")
    } catch (error) {
      setServiceError(error instanceof Error ? error.message : "Could not load rooms.")
    }
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedCode(code)
      window.setTimeout(() => setCopiedCode(""), 1800)
    } catch {
      setCopiedCode("")
    }
  }

  async function copyPlayerLink(code: string) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/room/${code}/join`)
      setCopiedPlayerLinkCode(code)
      window.setTimeout(() => setCopiedPlayerLinkCode(""), 1800)
    } catch {
      setServiceError("Could not copy the player link. Check your browser's clipboard permissions.")
    }
  }

  const playerCount = rooms.reduce((total, room) => total + room.playerCount, 0)

  return (
    <QuizShell>
      <section className="mx-auto max-w-[1100px]" aria-labelledby="dashboard-title">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <PageHeading id="dashboard-title" eyebrow="Host workspace" title={<>Quiz <span className="text-gradient">control room.</span></>} description="Create rooms, manage quiz content, and keep every session moving." />
          {!isCreatingQuiz && !editingQuiz && <button type="button" onClick={() => setIsCreatingQuiz(true)} className={`${primaryButtonClass} mb-8 shrink-0 sm:mb-8`}><Plus data-icon="inline-start" /> Create Quiz</button>}
        </div>
        {serviceError && <p role="alert" className="mb-5 rounded-xl border border-[#fa718d]/20 bg-[#fa718d]/[0.07] px-4 py-3 text-sm text-[#ffa0b1]">{serviceError}</p>}
        {roomSetupQuiz && <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="room-settings-title" className={`${surfaceClass} w-full max-w-lg p-6 sm:p-7`}>
            <div className="mb-6 flex items-start justify-between gap-4">
              <div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#63e9c8]">New room</p><h2 id="room-settings-title" className="mt-1 text-lg font-bold text-white">Room settings</h2><p className="mt-1 text-xs text-white/45">{roomSetupQuiz.title}</p></div>
              <button type="button" onClick={() => setRoomSetupQuiz(null)} className={secondaryButtonClass} aria-label="Close room settings"><X className="size-4" /></button>
            </div>
            <form onSubmit={(event) => { event.preventDefault(); void createRoomForQuiz(roomSetupQuiz) }} className="space-y-5">
              <label htmlFor="room-player-limit" className="flex flex-col gap-2 text-xs font-semibold text-white/70">Maximum players
                <input id="room-player-limit" type="number" min={2} max={500} step={1} inputMode="numeric" placeholder="Unlimited" value={playerLimitInput} onChange={(event) => { setPlayerLimitInput(event.target.value); if (!event.target.value) setAutoStartWhenFull(false) }} className="h-11 rounded-lg border border-white/[0.12] bg-black/20 px-3 text-sm text-white placeholder:text-white/30 focus:border-[#10d7ac]/50 focus:outline-none" />
                <span className="font-normal text-white/40">Leave blank for no limit. Choose 2 to 500 players.</span>
              </label>
              <label className={`flex items-start gap-3 rounded-lg border border-white/[0.08] p-3 ${playerLimitInput ? "cursor-pointer" : "opacity-45"}`}>
                <input type="checkbox" checked={autoStartWhenFull} disabled={!playerLimitInput} onChange={(event) => setAutoStartWhenFull(event.target.checked)} className="mt-0.5 size-4 accent-[#10d7ac]" />
                <span><span className="block text-xs font-semibold text-white/75">Automatically start when full</span><span className="mt-1 block text-[11px] text-white/40">Starts the first question as soon as the player limit is reached.</span></span>
              </label>
              <div className="flex justify-end gap-2 border-t border-white/[0.08] pt-4">
                <button type="button" onClick={() => setRoomSetupQuiz(null)} className={secondaryButtonClass}>Cancel</button>
                <button type="submit" disabled={isCreatingRoom} className={primaryButtonClass}>{isCreatingRoom ? "Creating..." : "Create room"}</button>
              </div>
            </form>
          </section>
        </div>}
        {(isCreatingQuiz || editingQuiz) && <div className="mb-7"><QuizBuilder key={editingQuiz?.id ?? "new-quiz"} quiz={editingQuiz ?? undefined} onCancel={() => { setEditingQuiz(null); setIsCreatingQuiz(false) }} onSave={saveQuiz} /></div>}
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <StatCard label="Saved quizzes" value={String(quizzes.length).padStart(2, "0")} icon={<Radio className="size-4" />} />
          <StatCard label="Players online" value={String(playerCount).padStart(2, "0")} icon={<UsersRound className="size-4" />} />
          <StatCard label="Active rooms" value={String(rooms.filter((room) => room.phase !== "COMPLETED").length).padStart(2, "0")} icon={<CalendarDays className="size-4" />} />
        </div>
        <div className={`${surfaceClass} mb-6 overflow-hidden`}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-5 py-4 sm:px-6">
            <div><h2 className="text-base font-bold">Your quizzes</h2><p className="mt-1 text-xs text-white/40">Create and manage quiz content</p></div>
            <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-[11px] text-white/45">{quizzes.length} quizzes</span>
          </div>
          {quizzes.length ? <div className="divide-y divide-white/[0.06]">{quizzes.map((quiz) => <article key={quiz.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="min-w-0"><h3 className="truncate text-sm font-semibold text-white">{quiz.title}</h3><p className="mt-1 text-xs text-white/40">{quiz.rounds.length} rounds · {quiz.rounds.reduce((total, round) => total + round.questions.length, 0)} questions{quiz.description ? ` · ${quiz.description}` : ""}</p></div>
            <div className="flex gap-2"><button type="button" onClick={() => { setIsCreatingQuiz(false); setEditingQuiz(quiz) }} className={secondaryButtonClass}><Pencil className="size-3.5" /> Edit</button><button type="button" onClick={() => openRoomSettings(quiz)} className={primaryButtonClass}><Plus className="size-3.5" /> Create room</button></div>
          </article>)}</div> : <p className="px-5 py-8 text-center text-xs text-white/40">No quizzes yet. Create one to get started.</p>}
        </div>
        <div className={`${surfaceClass} overflow-hidden`}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-5 py-4 sm:px-6">
            <div><h2 className="text-base font-bold">Your rooms</h2><p className="mt-1 text-xs text-white/40">Rooms hosted from your quizzes</p></div>
            <button type="button" onClick={() => void refreshRooms()} className={secondaryButtonClass}>Refresh</button>
          </div>
          {rooms.length ? <div className="divide-y divide-white/[0.06]">{rooms.map((room) => (
            <article key={room.code} className="flex flex-col gap-4 px-5 py-4 transition hover:bg-white/[0.025] sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div className="flex min-w-0 items-start gap-3.5">
                <span className={`mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl border ${room.phase === "COMPLETED" ? "border-white/[0.08] bg-white/[0.04] text-white/40" : "border-[#10d7ac]/20 bg-[#10d7ac]/[0.08] text-[#63e9c8]"}`}><CirclePlay className="size-4" /></span>
                <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-sm font-semibold text-white">{room.quizTitle}</h3><span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold text-white/55">{room.phase.replaceAll("_", " ")}</span></div><p className="mt-1.5 text-xs text-white/40">{room.playerLimit === null ? room.playerCount : `${room.playerCount}/${room.playerLimit}`} players{room.autoStartWhenFull ? " · Auto-start when full" : ""} <span className="px-1 text-white/20">·</span> Room {room.code}</p></div>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <button type="button" onClick={() => void copyCode(room.code)} className={secondaryButtonClass} aria-label={`Copy room code ${room.code}`}><Copy className="size-3.5" />{copiedCode === room.code ? "Copied" : room.code}</button>
                <Link href={`/room/${room.code}/host`} className={`${secondaryButtonClass} min-h-11`}>Host controls <ArrowRight className="size-3.5" /></Link>
                <button type="button" onClick={() => void copyPlayerLink(room.code)} className={`${secondaryButtonClass} min-h-11`} aria-label={`Copy player link for room ${room.code}`}>
                  {copiedPlayerLinkCode === room.code ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  {copiedPlayerLinkCode === room.code ? "Copied player link" : "Copy player link"}
                </button>
              </div>
            </article>
          ))}</div> : <p className="px-5 py-8 text-center text-xs text-white/40">No rooms have been created yet.</p>}
        </div>
      </section>
    </QuizShell>
  )
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return <div className={`${surfaceClass} flex items-center gap-3.5 p-4`}><span className="flex size-9 items-center justify-center rounded-xl bg-white/[0.05] text-[#6ce8c9]">{icon}</span><div><p className="text-[10px] font-semibold tracking-[0.12em] text-white/35 uppercase">{label}</p><p className="mt-1 text-xl font-bold tracking-tight text-white">{value}</p></div></div>
}
