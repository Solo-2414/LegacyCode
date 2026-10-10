"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import Link from "next/link"
import { ArrowRight, Check, UsersRound } from "lucide-react"
import { PageHeading, QuizShell, fieldClass, primaryButtonClass, secondaryButtonClass, surfaceClass } from "@/components/quiz-shell"
import { getRoom } from "@/lib/quiz-api"
import { getRealtimeSocket } from "@/lib/realtime"
import type { RoomState } from "@/lib/game-types"

type TeamChangedPayload = {
  teamName: string
  players: Array<{ teamName: string }>
}

function teamsFromPlayers(players: TeamChangedPayload["players"]) {
  const teams = new Map<string, number>()
  for (const player of players) {
    teams.set(player.teamName, (teams.get(player.teamName) ?? 0) + 1)
  }
  return [...teams.entries()].map(([name, playerCount]) => ({ name, playerCount })).sort((first, second) => first.name.localeCompare(second.name))
}

type StoredParticipantSession = {
  participant_id: string
  team_id: string
  nickname: string
  team_name: string
  room_code: string
}

function participantSessionKey(code: string) {
  return `techis-participant:${code}`
}

export function TeamJoinPage({ code }: { code: string }) {
  const [nickname, setNickname] = useState("")
  const [teamMode, setTeamMode] = useState<"create" | "join">("create")
  const [teamName, setTeamName] = useState("")
  const [selectedTeam, setSelectedTeam] = useState("")
  const [room, setRoom] = useState<RoomState | null>(null)
  const [userId, setUserId] = useState("")
  const userIdRef = useRef("")
  const [joined, setJoined] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    void getRoom(code).then(setRoom).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Room could not be found."))
    void fetch("/api/auth/session", { cache: "no-store" }).then((response) => response.json()).then((result: { session?: { userId: string } }) => {
      userIdRef.current = result.session?.userId ?? ""
      setUserId(userIdRef.current)
    })
    const savedNickname = window.sessionStorage.getItem(`techis-player-name:${code}`)
    const savedTeamName = window.sessionStorage.getItem(`techis-player-team:${code}`)
    if (savedNickname && savedTeamName) {
      setNickname(savedNickname)
      setTeamName(savedTeamName)
    }
    const storedSession = window.localStorage.getItem(participantSessionKey(code))
    if (storedSession) {
      try {
        const session = JSON.parse(storedSession) as StoredParticipantSession
        if (session.room_code === code && session.participant_id && session.team_id && session.nickname && session.team_name) {
          setNickname(session.nickname)
          setTeamName(session.team_name)
          setJoined(true)
        }
      } catch {
        window.localStorage.removeItem(participantSessionKey(code))
      }
    }
  }, [code])

  useEffect(() => {
    const socket = getRealtimeSocket()
    const storedSessionValue = window.localStorage.getItem(participantSessionKey(code))
    let storedSession: StoredParticipantSession | undefined
    if (storedSessionValue) {
      try {
        const parsed = JSON.parse(storedSessionValue) as StoredParticipantSession
        if (parsed.room_code === code && parsed.participant_id && parsed.team_id && parsed.nickname && parsed.team_name) storedSession = parsed
      } catch {
        window.localStorage.removeItem(participantSessionKey(code))
      }
    }
    const onState = (state: RoomState) => {
      setRoom(state)
      if (state.phase !== "LOBBY" && userIdRef.current && state.players.some((player) => player.id === userIdRef.current)) {
        window.location.assign(state.phase === "COMPLETED" ? `/room/${code}/leaderboard` : `/room/${code}/play`)
      }
    }
    const onTeamChanged = (update: TeamChangedPayload) => {
      setRoom((currentRoom) => currentRoom ? {
        ...currentRoom,
        teams: teamsFromPlayers(update.players),
      } : currentRoom)
    }
    const onTeamCreated = (team: { name: string; playerCount: number }) => {
      setRoom((currentRoom) => {
        if (!currentRoom || currentRoom.teams.some((existingTeam) => existingTeam.name.toLocaleLowerCase() === team.name.toLocaleLowerCase())) return currentRoom
        return { ...currentRoom, teams: [...currentRoom.teams, team].sort((first, second) => first.name.localeCompare(second.name)) }
      })
    }
    const reconnectParticipant = () => {
      if (!storedSession) {
        socket.emit("room:watch", { code }, (result) => {
          if (!result.ok) setError(result.error ?? "Could not watch the room.")
        })
        return
      }
      socket.emit("room:join", { code, participantId: storedSession.participant_id, nickname: storedSession.nickname, teamName: storedSession.team_name }, (result) => {
        if (result.ok) {
          if (result.participantId && result.teamId) window.localStorage.setItem(participantSessionKey(code), JSON.stringify({ ...storedSession, participant_id: result.participantId, team_id: result.teamId }))
          setJoined(true)
          return
        }
        window.localStorage.removeItem(participantSessionKey(code))
        setJoined(false)
        setError(result.error ?? "Your participant session expired. Join the room again.")
      })
    }
    socket.on("room:state", onState)
    socket.on("room:team-changed", onTeamChanged)
    socket.on("room:team-created", onTeamCreated)
    socket.on("connect", reconnectParticipant)
    if (!socket.connected) socket.connect()
    else reconnectParticipant()
    return () => {
      socket.off("room:state", onState)
      socket.off("room:team-changed", onTeamChanged)
      socket.off("room:team-created", onTeamCreated)
      socket.off("connect", reconnectParticipant)
    }
  }, [code])

  function join(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const cleanNickname = nickname.trim().replace(/\s+/g, " ")
    const cleanTeamName = (teamMode === "create" ? teamName : selectedTeam).trim().replace(/\s+/g, " ")
    if (!cleanNickname || cleanNickname.length > 24 || !cleanTeamName) {
      setError(cleanNickname.length > 24 ? "Keep your nickname to 24 characters or fewer." : !cleanNickname ? "Enter a nickname to join." : "Choose a team to join.")
      return
    }
    if (!/^[\p{L}\p{N} _-]+$/u.test(cleanNickname)) {
      setError("Use letters, numbers, spaces, underscores, or hyphens.")
      return
    }
    setPending(true)
    setError("")
    window.sessionStorage.setItem(`techis-player-name:${code}`, cleanNickname)
    window.sessionStorage.setItem(`techis-player-team:${code}`, cleanTeamName)
    const socket = getRealtimeSocket()
    const submitJoin = () => socket.emit("room:join", { code, nickname: cleanNickname, teamName: cleanTeamName }, (result) => {
      setPending(false)
      if (result.ok) {
        if (result.participantId && result.teamId) window.localStorage.setItem(participantSessionKey(code), JSON.stringify({ participant_id: result.participantId, team_id: result.teamId, nickname: cleanNickname, team_name: cleanTeamName, room_code: code } satisfies StoredParticipantSession))
        setJoined(true)
      } else setError(result.error ?? "Could not join the room.")
    })
    if (socket.connected) submitJoin()
    else {
      socket.once("connect", submitJoin)
      socket.connect()
    }
  }

  const players = room?.players ?? []
  const teams = room?.teams ?? []
  const chosenTeam = (teamMode === "create" ? teamName : selectedTeam).trim()

  return (
    <QuizShell>
      <section className="mx-auto max-w-[900px]" aria-labelledby="join-title">
        <PageHeading id="join-title" eyebrow={`Room ${code}`} title={<>Join the <span className="text-gradient">game.</span></>} description={room?.quizTitle ?? "Enter your nickname and join the waiting room."} />
        {error && <p role="alert" className="mb-5 rounded-xl border border-[#fa718d]/20 bg-[#fa718d]/[0.07] px-4 py-3 text-sm text-[#ffa0b1]">{error}</p>}
        {!room ? <div className={`${surfaceClass} p-7 text-center text-sm text-white/45`}>{error ? "This room is unavailable." : "Checking room…"}</div> : joined ? <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
          <section className={`${surfaceClass} p-5 sm:p-6`} aria-live="polite">
            <span className="mb-4 flex size-11 items-center justify-center rounded-xl border border-[#10d7ac]/20 bg-[#10d7ac]/[0.08] text-[#6ce8c9]"><Check className="size-5" /></span>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#62e8cb]">You&apos;re in</p><h2 className="mt-1 text-xl font-bold text-white">{chosenTeam} is ready</h2>
            <p className="mt-2 text-sm text-white/45">Playing as <span className="font-semibold text-white/80">{nickname}</span>. Waiting for the host.</p>
            <div className="mt-5 rounded-xl border border-white/[0.07] bg-black/10 p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">Join code</p><p className="mt-1 font-mono text-xl font-bold tracking-[0.15em] text-white">{code}</p></div>
          </section>
          <section className={`${surfaceClass} p-5 sm:p-6`}><div className="mb-4 flex items-center justify-between"><div><h2 className="text-base font-bold text-white">Players in the room</h2><p className="mt-1 text-xs text-white/40">{players.filter((player) => player.isConnected).length} connected</p></div><UsersRound className="size-5 text-[#6ce8c9]" /></div>
            <ul className="grid gap-2 sm:grid-cols-2">{players.map((player) => <li key={player.id} className="flex items-center gap-3 rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-3"><span className={`size-2 rounded-full ${player.isConnected ? "bg-[#10d7ac]" : "bg-white/25"}`} /><span className="min-w-0 flex-1 truncate text-sm font-medium text-white/80">{player.nickname}<span className="ml-2 text-[10px] text-white/35">{player.teamName}</span></span>{player.id === userId && <span className="text-[10px] text-[#72edce]">You</span>}</li>)}</ul>
          </section>
        </div> : <form onSubmit={join} className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
          <section className={`${surfaceClass} p-5 sm:p-6`}><h2 className="text-base font-bold text-white">Your player name</h2><p className="mt-1 text-xs text-white/40">This is how you&apos;ll appear in the standings.</p>
            <label htmlFor="nickname" className="mt-5 flex flex-col gap-2 text-xs font-semibold text-white/65">Nickname<input id="nickname" className={fieldClass} autoComplete="nickname" maxLength={24} placeholder="e.g. pixelpilot" value={nickname} onChange={(event) => setNickname(event.target.value)} required /></label>
          </section>
          <section className={`${surfaceClass} p-5 sm:p-6`}>
            <h2 className="text-base font-bold text-white">Choose your team</h2>
            <div className="mt-4 flex w-full rounded-lg border border-white/[0.07] bg-gray-800 p-1">
              <button type="button" aria-pressed={teamMode === "create"} onClick={() => setTeamMode("create")} className={`min-h-10 flex-1 rounded-md px-2 py-3 text-xs font-semibold transition ${teamMode === "create" ? "bg-[#10d7ac]/[0.12] text-[#72edce]" : "text-white/45 hover:text-white"}`}>Create a Team</button>
              <button type="button" aria-pressed={teamMode === "join"} onClick={() => setTeamMode("join")} className={`min-h-10 flex-1 rounded-md px-2 py-3 text-xs font-semibold transition ${teamMode === "join" ? "bg-[#4cbce0]/[0.12] text-[#88dbf4]" : "text-white/45 hover:text-white"}`}>Join Existing Team</button>
            </div>
            {teamMode === "create" ? <label htmlFor="team-name" className="mt-4 flex flex-col gap-2 text-xs font-semibold text-white/65">Team name<input id="team-name" className={fieldClass} maxLength={28} placeholder="e.g. The Syntax Squad" value={teamName} onChange={(event) => setTeamName(event.target.value)} required /></label> : <fieldset className="mt-4"><legend className="mb-2 text-xs font-semibold text-white/65">Available teams</legend><div className="grid gap-2 sm:grid-cols-2">{teams.map((team) => <button key={team.name} type="button" aria-pressed={selectedTeam === team.name} onClick={() => setSelectedTeam(team.name)} className={`flex min-h-12 items-center justify-between gap-2 rounded-lg border px-3 text-left transition ${selectedTeam === team.name ? "border-[#10d7ac]/40 bg-[#10d7ac]/[0.08]" : "border-white/[0.08] bg-black/10 hover:border-white/20"}`}><span className="truncate text-xs font-semibold text-white/85">{team.name}</span><span className="shrink-0 text-[10px] text-white/40">{team.playerCount}</span></button>)}</div>{teams.length === 0 && <p className="py-4 text-center text-xs text-white/35">No teams yet. Create the first one.</p>}</fieldset>}
            <button type="submit" disabled={pending || !nickname.trim() || !chosenTeam} className={`${primaryButtonClass} mt-5 w-full`}>{pending ? "Joining…" : "Join room"}<ArrowRight className="size-4" /></button>
            <div className="mt-5 border-t border-white/[0.07] pt-4"><p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">Players · {players.filter((player) => player.isConnected).length} connected</p><ul className="flex flex-wrap gap-x-4 gap-y-2">{players.map((player) => <li key={player.id} className="text-xs text-white/65">{player.nickname}<span className="ml-1.5 text-[10px] text-white/35">{player.teamName}</span></li>)}</ul></div>
          </section>
        </form>}
        <div className="mt-5 flex justify-center"><Link href="/" className={secondaryButtonClass}>Back to home</Link></div>
      </section>
    </QuizShell>
  )
}
