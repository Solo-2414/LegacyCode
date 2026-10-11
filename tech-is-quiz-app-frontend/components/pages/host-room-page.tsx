"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ArrowRight, Check, Clock3, Copy, Crown, Radio, UserX, UsersRound, X } from "lucide-react"
import { PageHeading, QuizShell, primaryButtonClass, secondaryButtonClass, surfaceClass } from "@/components/quiz-shell"
import { getRealtimeSocket } from "@/lib/realtime"
import { useGameAudio } from "@/components/game-audio-provider"
import { AnimatedNumber } from "@/components/animated-number"
import { Confetti } from "@/components/confetti"
import { StandingsToggle, TeamRows, type StandingsView } from "@/components/team-standings"
import type { RoomPlayer, RoomState } from "@/lib/game-types"

export function HostRoomPage({ code }: { code: string }) {
  const [room, setRoom] = useState<RoomState | null>(null)
  const [error, setError] = useState("")
  const [seconds, setSeconds] = useState(0)
  const [copied, setCopied] = useState(false)
  const [standingsView, setStandingsView] = useState<StandingsView>("players")
  const previousPlayerCount = useRef(0)
  const previousSeconds = useRef<number | null>(null)
  const previousPhase = useRef<RoomState["phase"] | null>(null)
  const { startLobbyMusic, stopLobbyMusic, playSound } = useGameAudio()

  useEffect(() => {
    const hostKey = window.sessionStorage.getItem(`techis-host:${code}`)
    if (!hostKey) {
      setError("Host access is missing. Create or reopen this room from the dashboard.")
      return
    }
    const socket = getRealtimeSocket()
    const join = () => socket.emit("room:join", { code, role: "host", hostKey }, (result) => {
      if (!result.ok) setError(result.error ?? "Could not join the host room.")
    })
    const onState = (state: RoomState) => {
      setRoom(state)
      setError("")
    }
    socket.on("connect", join)
    socket.on("room:state", onState)
    if (socket.connected) join()
    else socket.connect()
    return () => {
      socket.off("connect", join)
      socket.off("room:state", onState)
    }
  }, [code])

  useEffect(() => {
    if (!room?.endsAt) return
    const tick = () => setSeconds(Math.max(0, Math.ceil((room.endsAt! - Date.now()) / 1000)))
    tick()
    const timer = window.setInterval(tick, 250)
    return () => window.clearInterval(timer)
  }, [room?.endsAt])

  useEffect(() => {
    if (room?.phase === "LOBBY") startLobbyMusic()
    else stopLobbyMusic()
    return () => stopLobbyMusic()
  }, [room?.phase, startLobbyMusic, stopLobbyMusic])

  // Player join: chime for the host
  useEffect(() => {
    if (!room) return
    if (room.players.length > previousPlayerCount.current && previousPlayerCount.current > 0) playSound("playerJoin")
    previousPlayerCount.current = room.players.length
  }, [playSound, room])

  // Phase changes: game start, answer reveal, final fanfare
  useEffect(() => {
    const phase = room?.phase
    const previous = previousPhase.current
    previousPhase.current = phase ?? null
    if (!phase || previous === null || previous === phase) return
    if (previous === "LOBBY" && phase === "QUESTION") playSound("gameStart")
    if (phase === "REVEAL") playSound("reveal")
    if (phase === "COMPLETED") playSound("podiumFanfare")
  }, [playSound, room?.phase])

  // Countdown: soft tick, faster tick for the last 5 seconds, bell at zero
  useEffect(() => {
    if (room?.phase !== "QUESTION") { previousSeconds.current = null; return }
    const last = previousSeconds.current
    previousSeconds.current = seconds
    if (last === null || last === seconds) return
    if (seconds === 0) playSound("timeUp")
    else if (seconds <= 5) playSound("timerUrgent")
    else playSound("timerTick")
  }, [playSound, room?.phase, seconds])

  function control(event: "room:start" | "room:reveal" | "room:leaderboard" | "room:next") {
    getRealtimeSocket().emit(event, { code })
  }

  function kickPlayer(player: RoomPlayer) {
    if (!window.confirm(`Remove ${player.nickname} from the room? They will not be able to rejoin.`)) return
    getRealtimeSocket().emit("room:kick", { code, playerId: player.id }, (result) => {
      if (!result?.ok) setError(result?.error ?? "Could not remove that player.")
    })
  }

  async function copyJoinLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/room/${code}/join`)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  const connectedPlayers = room?.players.filter((player) => player.isConnected) ?? []
  const topPlayers = room?.players.slice(0, 10) ?? []

  return (
    <QuizShell>
      <Confetti active={room?.phase === "COMPLETED"} />
      <section className="mx-auto max-w-[1000px]" aria-labelledby="host-room-title">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.17em] text-[#62e8cb]">Room {code}</p><h1 id="host-room-title" className="mt-1 text-xl font-bold tracking-tight text-white">{room?.quizTitle ?? "Host room"}</h1></div>
          <button type="button" onClick={() => void copyJoinLink()} className={secondaryButtonClass}><Copy className="size-3.5" />{copied ? "Copied join link" : "Copy player link"}</button>
        </div>
        {error && <p role="alert" className="mb-5 rounded-xl border border-[#fa718d]/20 bg-[#fa718d]/[0.07] px-4 py-3 text-sm text-[#ffa0b1]">{error}</p>}
        {!room ? <div className={`${surfaceClass} p-8 text-center text-sm text-white/45`}>{error ? "Room unavailable" : "Connecting to room…"}</div> : <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <HostStat label="Room status" value={room.phase.replaceAll("_", " ")} icon={<Radio className="size-4" />} />
            <HostStat label="Players connected" value={`${connectedPlayers.length} / ${room.players.length}`} icon={<UsersRound className="size-4" />} />
            <HostStat label="Round" value={room.phase === "LOBBY" ? "Waiting room" : room.phase === "COMPLETED" ? "Finished" : room.roundTitle} icon={<Clock3 className="size-4" />} />
          </div>
          {room.phase === "LOBBY" ? <div className={`${surfaceClass} p-5 sm:p-7`}>
            <PageHeading eyebrow="Waiting room" title={<>Bring everyone <span className="text-gradient">together.</span></>} description="Share the six-digit code or player link. Players appear here as they connect." />
            <div className="mb-6 flex flex-col items-center rounded-xl border border-white/[0.08] bg-black/15 px-5 py-6"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">Join code</p><p className="mt-1 font-mono text-4xl font-bold tracking-[0.18em] text-white">{code}</p><span className="mt-2 text-xs text-white/40">{connectedPlayers.length} connected</span></div>
            <PlayerRoster players={room.players} onKick={kickPlayer} />
            <button type="button" onClick={() => control("room:start")} className={`${primaryButtonClass} mt-6 w-full`}>Start game <ArrowRight className="size-4" /></button>
          </div> : room.phase === "QUESTION" ? <div className={`${surfaceClass} p-5 sm:p-7`}>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold text-[#62e8cb]">{room.roundTitle} · Question {room.questionIndex + 1}</p><h2 className="mt-2 text-2xl font-bold text-white">{room.question?.questionText}</h2></div><div className="text-right"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/40">Time left</p><p className={`mt-1 text-3xl font-bold tabular-nums ${seconds <= 5 ? "anim-urgent text-[#ffa0b1]" : "text-white"}`}>{seconds}s</p></div></div>
            <div className="mb-5 h-2 overflow-hidden rounded-full bg-white/[0.07]"><div className="h-full bg-[#10d7ac] transition-[width] duration-200" style={{ width: `${room.question ? seconds / room.question.timeLimitSec * 100 : 0}%` }} /></div>
            <p className="text-xs text-white/45">{room.players.filter((player) => player.hasAnswered).length} of {room.players.length} answers submitted · {room.question?.points} points</p>
            <button type="button" onClick={() => control("room:reveal")} className={`${primaryButtonClass} mt-6 w-full`}>Lock answers and reveal <Check className="size-4" /></button>
          </div> : room.phase === "REVEAL" ? <div className={`${surfaceClass} p-5 sm:p-7`}>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#62e8cb]">Answer reveal</p><h2 className="mt-2 text-2xl font-bold text-white">{room.question?.questionText}</h2>
            {room.question?.type === "IDENTIFICATION" ? <p className="mt-5 rounded-xl border border-[#10d7ac]/25 bg-[#10d7ac]/[0.08] p-4 text-sm font-semibold text-[#72edce]">Accepted: {room.question.acceptedAnswers?.join(", ")}</p> : <div className="mt-5 grid gap-2 sm:grid-cols-2">{room.question?.options.map((option, index) => ({ option, index })).filter(({ option }) => option.trim()).map(({ option, index }) => <div key={index} className={`flex min-h-12 items-center gap-3 rounded-xl border px-4 text-sm ${room.question?.correctOptions?.includes(index) ? "border-[#10d7ac]/40 bg-[#10d7ac]/[0.09] text-[#72edce]" : "border-white/[0.07] bg-white/[0.025] text-white/50"}`}>{room.question?.correctOptions?.includes(index) ? <Check className="size-4" /> : <X className="size-4" />}{option}</div>)}</div>}
            <div className={`mt-5 grid gap-3 ${room.partialCredit ? "grid-cols-3" : "grid-cols-2"}`}>{(() => { const correctCount = room.players.filter((player) => player.isCorrect).length; const partialCount = room.players.filter((player) => player.isPartial).length; return <><HostStat label="Correct" value={String(correctCount)} icon={<Check className="size-4" />} />{room.partialCredit && <HostStat label="Partial credit" value={String(partialCount)} icon={<Check className="size-4" />} />}<HostStat label="Incorrect / no answer" value={String(room.players.length - correctCount - partialCount)} icon={<X className="size-4" />} /></> })()}</div>
            <button type="button" onClick={() => control("room:leaderboard")} className={`${primaryButtonClass} mt-6 w-full`}>Show leaderboard <ArrowRight className="size-4" /></button>
          </div> : room.phase === "LEADERBOARD" || room.phase === "COMPLETED" ? <div className={`${surfaceClass} p-5 sm:p-7`}>
            <div className="mb-5 flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl border border-[#ffd169]/20 bg-[#ffd169]/[0.08] text-[#ffd169]"><Crown className="size-5" /></span><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#ffd169]">{room.phase === "COMPLETED" ? "Quiz complete" : "Standings"}</p><h2 className="mt-1 text-xl font-bold text-white">Leaderboard</h2></div><div className="ml-auto"><StandingsToggle view={standingsView} onChange={setStandingsView} /></div></div>
            {standingsView === "teams" ? <TeamRows teams={room.teamStandings ?? []} /> : <LeaderboardRows players={topPlayers} onKick={room.phase === "LEADERBOARD" ? kickPlayer : undefined} />}
            {room.phase === "LEADERBOARD" && <button type="button" onClick={() => control("room:next")} className={`${primaryButtonClass} mt-6 w-full`}>{room.isLastQuestion ? "Finish quiz" : "Next question"} <ArrowRight className="size-4" /></button>}
            {room.phase === "COMPLETED" && <Link href={`/room/${code}/leaderboard`} className={`${secondaryButtonClass} mt-6 w-full`}>Open final podium <ArrowRight className="size-4" /></Link>}
          </div> : null}
        </>}
      </section>
    </QuizShell>
  )
}

function PlayerRoster({ players, onKick }: { players: RoomState["players"]; onKick: (player: RoomPlayer) => void }) {
  const teams = new Map<string, RoomState["players"]>()
  for (const player of players) {
    const teammates = teams.get(player.teamName) ?? []
    teammates.push(player)
    teams.set(player.teamName, teammates)
  }

  return players.length === 0 ? <p className="py-5 text-center text-xs text-white/40">Waiting for players to join.</p> : <div className="grid gap-x-6 sm:grid-cols-2">
    {[...teams.entries()].sort(([first], [second]) => first.localeCompare(second)).map(([teamName, teammates]) => <section key={teamName} aria-label={`Team ${teamName}`} className="border-t border-white/[0.07] py-3">
      <div className="flex items-center justify-between gap-3"><h2 className="truncate text-xs font-semibold text-white/80">{teamName}</h2><span className="shrink-0 text-[10px] text-white/40">{teammates.length} {teammates.length === 1 ? "player" : "players"}</span></div>
      <ul className="mt-2 divide-y divide-white/[0.06]">{teammates.map((player) => <li key={player.id} className="animate-in fade-in zoom-in-95 slide-in-from-left-2 duration-500 flex items-center gap-3 py-2"><span className={`size-2 shrink-0 rounded-full ${player.isConnected ? "bg-[#10d7ac]" : "bg-white/25"}`} /><span className="min-w-0 flex-1 truncate text-sm font-medium text-white/80">{player.nickname}</span><span className="shrink-0 text-[10px] text-white/40">{player.isConnected ? "Connected" : "Reconnecting"}</span><KickButton player={player} onKick={onKick} /></li>)}</ul>
    </section>)}
  </div>
}

function KickButton({ player, onKick }: { player: RoomPlayer; onKick: (player: RoomPlayer) => void }) {
  return <button type="button" onClick={() => onKick(player)} className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-white/30 transition hover:bg-[#fa718d]/[0.12] hover:text-[#ffa0b1]" aria-label={`Remove ${player.nickname} from the room`} title={`Remove ${player.nickname}`}><UserX className="size-3.5" /></button>
}

function LeaderboardRows({ players, onKick }: { players: RoomState["players"]; onKick?: (player: RoomPlayer) => void }) {
  return <ol className="stagger-children divide-y divide-white/[0.06]">{players.map((player, index) => <li key={player.id} className="flex items-center gap-3 py-3"><span className={`w-7 text-center text-sm font-bold ${index === 0 ? "text-[#ffd169]" : "text-white/40"}`}>{index + 1}</span><span className="min-w-0 flex-1 truncate text-sm font-medium text-white/80">{player.nickname}</span><span className="text-sm font-bold tabular-nums text-white"><AnimatedNumber value={player.score} /> <span className="text-[10px] font-medium text-white/35">pts</span></span>{onKick && <KickButton player={player} onKick={onKick} />}</li>)}{players.length === 0 && <li className="py-6 text-center text-sm text-white/40">No players joined this room.</li>}</ol>
}

function HostStat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return <div className={`${surfaceClass} flex min-w-0 items-center gap-3 px-4 py-3`}><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] text-[#6ce8c9]">{icon}</span><div className="min-w-0"><p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/35">{label}</p><p className="mt-1 truncate text-sm font-bold text-white">{value}</p></div></div>
}