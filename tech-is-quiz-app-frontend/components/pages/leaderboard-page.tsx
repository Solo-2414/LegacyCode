"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Crown, Trophy } from "lucide-react"
import { QuizShell, secondaryButtonClass, surfaceClass } from "@/components/quiz-shell"
import { getRealtimeSocket } from "@/lib/realtime"
import { useGameAudio } from "@/components/game-audio-provider"
import type { RoomState, RoomPlayer } from "@/lib/game-types"

export function LeaderboardPage({ code }: { code: string }) {
  const [room, setRoom] = useState<RoomState | null>(null)
  const [error, setError] = useState("")
  const { playSound } = useGameAudio()
  const fanfarePlayed = useRef(false)

  useEffect(() => {
    const socket = getRealtimeSocket()
    const watch = () => socket.emit("room:watch", { code }, (result) => {
      if (!result.ok) setError(result.error ?? "Could not load room standings.")
    })
    const onState = (state: RoomState) => setRoom(state)
    socket.on("connect", watch)
    socket.on("room:state", onState)
    if (socket.connected) watch()
    else socket.connect()
    return () => {
      socket.off("connect", watch)
      socket.off("room:state", onState)
    }
  }, [code])

  useEffect(() => {
    if (room?.phase === "COMPLETED" && !fanfarePlayed.current) { fanfarePlayed.current = true; playSound("podiumFanfare") }
  }, [room?.phase, playSound])

  const players = room?.players ?? []
  const podium = [players[1], players[0], players[2]].filter((player): player is RoomPlayer => Boolean(player))

  return (
    <QuizShell>
      <section className="mx-auto max-w-[900px]" aria-labelledby="leaderboard-title">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><p className="text-[10px] font-bold uppercase tracking-[0.17em] text-[#62e8cb]">Room {code} <span className="px-1 text-white/20">/</span> {room?.phase === "COMPLETED" ? "Final results" : "Live standings"}</p><Link href={`/room/${code}/play`} className={secondaryButtonClass}><ArrowLeft className="size-3.5" />Back to game</Link></div>
        <div className={`${surfaceClass} relative overflow-hidden px-4 py-7 sm:px-8 sm:py-9`}>
          <div className="leader-glow" aria-hidden="true" />
          {!room ? <div className="relative py-12 text-center text-sm text-white/45">{error || "Connecting to standings…"}</div> : <>
            <div className="relative text-center"><span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-xl border border-[#ffd169]/20 bg-[#ffd169]/[0.08] text-[#ffd169]"><Trophy className="size-5" /></span><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#ffd169]">{room.phase === "COMPLETED" ? "Quiz complete" : room.phase === "LOBBY" ? "Waiting room" : "Current standings"}</p><h1 id="leaderboard-title" className="mt-1.5 text-2xl font-bold text-white sm:text-3xl">{room.quizTitle}</h1><p className="mt-2 text-sm text-white/45">{players.length} players <span className="px-1 text-white/20">·</span> {room.phase.replaceAll("_", " ")}</p></div>
            {podium.length > 0 && <div className="relative mx-auto mt-8 grid max-w-[600px] grid-cols-3 items-end gap-2 sm:mt-10 sm:gap-4" aria-label="Top three players by score">
              {podium.map((player) => {
                const rank = players.indexOf(player) + 1
                const tone = rank === 1 ? "gold" : rank === 2 ? "silver" : "bronze"
                return <article key={player.id} className="flex min-w-0 flex-col items-center text-center">
                  <span className={`mb-2 text-[9px] font-semibold uppercase tracking-[0.1em] sm:text-[10px] ${tone === "gold" ? "text-[#ffd169]" : tone === "silver" ? "text-[#c4d1de]" : "text-[#d99569]"}`}>{rank === 1 ? "Champion" : rank === 2 ? "Runner-up" : "Third place"}</span>
                  <span className={`mb-2 flex size-11 items-center justify-center rounded-xl border text-xs font-bold sm:size-14 sm:text-sm ${tone === "gold" ? "border-[#ffd169]/40 bg-[#ffd169]/[0.12] text-[#ffd169]" : tone === "silver" ? "border-[#c4d1de]/30 bg-[#c4d1de]/[0.10] text-[#c4d1de]" : "border-[#d99569]/35 bg-[#d99569]/[0.10] text-[#e3aa82]"}`}>{player.nickname.slice(0, 2).toUpperCase()}</span>
                  {rank === 1 && <Crown className="mb-1 size-4 text-[#ffd169]" aria-label="First place" />}
                  <p className="max-w-full truncate text-[11px] font-bold text-white sm:text-sm">{player.nickname}</p><p className="mt-1 text-[9px] text-white/40 sm:text-xs">{player.score.toLocaleString()} pts</p>
                  <div className={`mt-3 flex w-full items-start justify-center rounded-t-xl border-t pt-3 ${rank === 1 ? "h-[125px] border-[#ffd169]/40 bg-gradient-to-b from-[#ffd169]/[0.13] to-transparent" : rank === 2 ? "h-[98px] border-[#c4d1de]/30 bg-gradient-to-b from-[#c4d1de]/[0.10] to-transparent" : "h-[78px] border-[#d99569]/35 bg-gradient-to-b from-[#d99569]/[0.10] to-transparent"}`}><span className={`text-2xl font-black sm:text-3xl ${tone === "gold" ? "text-[#ffd169]/80" : tone === "silver" ? "text-[#c4d1de]/80" : "text-[#e3aa82]/80"}`}>{rank}</span></div>
                </article>
              })}
            </div>}
            <section className="relative mx-auto mt-5 max-w-[600px] overflow-hidden rounded-xl border border-white/[0.08] bg-black/15" aria-labelledby="remaining-players-title">
              <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3"><h2 id="remaining-players-title" className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">Player standings</h2><span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">Score</span></div>
              <ol className="max-h-[300px] divide-y divide-white/[0.05] overflow-y-auto">{players.map((player, index) => <li key={player.id} className="flex items-center gap-3 px-4 py-3"><span className="w-5 text-center text-xs font-semibold text-white/35">{index + 1}</span><span className="min-w-0 flex-1 truncate text-xs font-medium text-white/80">{player.nickname}{!player.isConnected && <span className="ml-2 text-[10px] text-white/35">Disconnected</span>}</span><span className="text-xs font-semibold tabular-nums text-white/65">{player.score.toLocaleString()} pts</span></li>)}{players.length === 0 && <li className="px-4 py-8 text-center text-xs text-white/40">No players have joined yet.</li>}</ol>
            </section>
          </>}
          <div className="relative mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row"><Link href="/admin/dashboard" className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#10d7ac] px-4 text-xs font-bold text-[#08251f] transition hover:bg-[#37e5bd] sm:ml-auto">Back to dashboard <ArrowLeft className="size-3.5 rotate-180" /></Link></div>
        </div>
      </section>
    </QuizShell>
  )
}
