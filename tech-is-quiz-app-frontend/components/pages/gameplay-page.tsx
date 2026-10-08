"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, Check, Clock3, Trophy } from "lucide-react"
import { QuizShell, fieldClass, primaryButtonClass, secondaryButtonClass, surfaceClass } from "@/components/quiz-shell"
import { getRealtimeSocket } from "@/lib/realtime"
import type { RoomState } from "@/lib/game-types"

const answerTones = ["answer-mint", "answer-blue", "answer-pink", "answer-yellow"]

export function GameplayPage({ code }: { code: string }) {
  const [room, setRoom] = useState<RoomState | null>(null)
  const [playerId, setPlayerId] = useState("")
  const [selected, setSelected] = useState<number[]>([])
  const [identification, setIdentification] = useState("")
  const [seconds, setSeconds] = useState(0)
  const [confirmed, setConfirmed] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState("")

  useEffect(() => {
    const id = window.sessionStorage.getItem(`techis-player-id:${code}`) ?? ""
    const nickname = window.sessionStorage.getItem(`techis-player-name:${code}`) ?? ""
    setPlayerId(id)
    const socket = getRealtimeSocket()
    const join = () => {
      if (id && nickname) socket.emit("room:join", { code, playerId: id, nickname }, (result) => {
        if (!result.ok) setMessage(result.error ?? "Could not reconnect to the room.")
      })
      else socket.emit("room:watch", { code }, (result) => {
        if (!result.ok) setMessage(result.error ?? "Room not found.")
      })
    }
    const onState = (state: RoomState) => setRoom(state)
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
    setSelected([])
    setIdentification("")
    setConfirmed(false)
    setSubmitted(false)
    setIsSubmitting(false)
    setMessage("")
  }, [room?.question?.id])

  useEffect(() => {
    if (!room?.endsAt) return
    const tick = () => setSeconds(Math.max(0, Math.ceil((room.endsAt! - Date.now()) / 1000)))
    tick()
    const timer = window.setInterval(tick, 250)
    return () => window.clearInterval(timer)
  }, [room?.endsAt])

  function sendAnswer(answer: string | number[]) {
    if (!playerId) {
      setMessage("Join this room with a nickname before answering.")
      return
    }
    if (submitted || currentPlayer?.hasAnswered === true) {
      setMessage("Your answer is already locked.")
      return
    }
    if (!confirmed) {
      setConfirmed(true)
      setMessage("Answer confirmed. Click again to lock it in.")
      return
    }
    if (isSubmitting) return

    setIsSubmitting(true)
    getRealtimeSocket().emit("room:submit", { code, playerId, answer }, (result) => {
      setIsSubmitting(false)
      if (!result.ok) {
        setConfirmed(false)
        setMessage(result.error ?? "Your answer could not be submitted.")
        return
      }
      setSubmitted(true)
      setConfirmed(false)
      setMessage(result.isCorrect ? `Correct · +${result.pointsAwarded ?? 0} points` : "Answer locked in. Not quite this time.")
    })
  }

  const question = room?.question
  const currentPlayer = room?.players.find((player) => player.id === playerId)
  const answerLocked = submitted || currentPlayer?.hasAnswered === true
  const progress = question && room?.endsAt ? `${Math.max(0, Math.min(100, seconds / question.timeLimitSec * 100))}%` : "0%"

  return (
    <QuizShell>
      <section className="mx-auto max-w-[1000px]" aria-labelledby="game-page-title">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4"><div><p className="text-[10px] font-bold tracking-[0.17em] text-[#62e8cb] uppercase">Room {code} · {room?.quizTitle ?? "Live game"}</p><h1 id="game-page-title" className="mt-1 text-xl font-bold tracking-tight text-white">{room?.roundTitle ?? "Game room"}</h1></div><span className="rounded-full border border-white/[0.08] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">Live question</span></div>
        {!room ? <div className={`${surfaceClass} p-8 text-center text-sm text-white/45`}>{message || "Connecting to the game…"}</div> : room.phase === "LOBBY" ? <div className={`${surfaceClass} p-8 text-center`}><h2 className="text-xl font-bold text-white">Waiting for the host</h2><p className="mt-2 text-sm text-white/45">You are connected. The first question will appear here when the host starts.</p><Link href={`/room/${code}/join`} className={`${secondaryButtonClass} mt-5`}>Return to waiting room</Link></div> : room.phase === "COMPLETED" || room.phase === "LEADERBOARD" ? <div className={`${surfaceClass} p-6 sm:p-8`}>
          <div className="mb-5 flex items-center gap-3"><span className="flex size-11 items-center justify-center rounded-xl border border-[#ffd169]/20 bg-[#ffd169]/[0.08] text-[#ffd169]"><Trophy className="size-5" /></span><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#ffd169]">{room.phase === "COMPLETED" ? "Final standings" : "Current standings"}</p><h2 className="mt-1 text-xl font-bold text-white">{room.phase === "COMPLETED" ? "Quiz complete" : "Leaderboard"}</h2></div></div>
          <ol className="divide-y divide-white/[0.06]">{room.players.slice(0, 10).map((player, index) => <li key={player.id} className="flex items-center gap-3 py-3"><span className={`w-7 text-center text-sm font-bold ${index === 0 ? "text-[#ffd169]" : "text-white/40"}`}>{index + 1}</span><span className="min-w-0 flex-1 truncate text-sm text-white/80">{player.nickname}{player.id === playerId ? <span className="ml-2 text-[10px] text-[#72edce]">You</span> : null}</span><span className="text-sm font-bold tabular-nums text-white">{player.score.toLocaleString()} <span className="text-[10px] text-white/35">pts</span></span></li>)}</ol>
          </div> : room.phase === "REVEAL" ? <div className={`${surfaceClass} p-5 sm:p-8`}>
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#62e8cb]">Answer revealed</p><h2 className="mt-2 text-2xl font-bold text-white">{question?.questionText}</h2>
          <div className={`mt-5 rounded-xl border px-4 py-4 text-sm font-semibold ${currentPlayer?.isCorrect ? "border-[#10d7ac]/30 bg-[#10d7ac]/[0.08] text-[#72edce]" : "border-[#fa718d]/25 bg-[#fa718d]/[0.07] text-[#ffa0b1]"}`}>{currentPlayer?.isCorrect ? `Correct · +${currentPlayer.pointsAwarded ?? 0} points` : "Not quite this time"}</div>
          {question?.type === "IDENTIFICATION" ? <p className="mt-4 text-sm text-white/60">Accepted: {question.acceptedAnswers?.join(", ")}</p> : <div className="mt-4 grid gap-2 sm:grid-cols-2">{question?.options.map((option, index) => ({ option, index })).filter(({ option }) => option.trim()).map(({ option, index }) => <div key={index} className={`rounded-lg border px-3 py-3 text-sm ${question.correctOptions?.includes(index) ? "border-[#10d7ac]/35 bg-[#10d7ac]/[0.08] text-[#72edce]" : "border-white/[0.07] text-white/45"}`}>{option}</div>)}</div>}
          <p className="mt-5 text-xs text-white/40">Your score: {currentPlayer?.score.toLocaleString() ?? 0} points. Waiting for the host to continue.</p>
        </div> : question ? <div className={`${surfaceClass} p-5 sm:p-8`}>
          <div className="mb-6 flex items-center gap-3" aria-label={`Time remaining: ${seconds} seconds`}><Clock3 className="size-4 shrink-0 text-[#4cbce0]" /><div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.07]"><div className="h-full rounded-full bg-gradient-to-r from-[#10d7ac] via-[#4cbce0] to-[#ffd169] transition-[width] duration-200" style={{ width: progress }} /></div><span className={`min-w-8 text-right text-xs font-semibold tabular-nums ${seconds <= 5 ? "text-[#ffa0b1]" : "text-white/60"}`}>{seconds}s</span></div>
          <div className="mb-7 text-center"><span className="mb-3 inline-flex rounded-full border border-[#4cbce0]/20 bg-[#4cbce0]/[0.08] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#88dbf4]">{question.type.replaceAll("_", " ")} · {question.points} pts</span><h2 className="mx-auto max-w-[720px] text-[25px] leading-[1.18] font-bold text-white sm:text-[36px]">{question.questionText}</h2></div>
          {question.type === "IDENTIFICATION" ? <div className="mx-auto flex max-w-2xl flex-col gap-3 sm:flex-row"><input aria-label="Type your answer" className={`${fieldClass} min-w-0 flex-1`} value={identification} onChange={(event) => setIdentification(event.target.value)} placeholder="Type your answer" disabled={confirmed || answerLocked || seconds === 0} /><button type="button" onClick={() => sendAnswer(identification.trim())} disabled={!identification.trim() || answerLocked || seconds === 0 || isSubmitting} className={primaryButtonClass}>{confirmed ? "Submit answer" : "Confirm answer"}<ArrowRight className="size-4" /></button></div> : <div className="mx-auto grid max-w-3xl gap-3 sm:grid-cols-2">{question.options.map((option, index) => ({ option, index })).filter(({ option }) => option.trim()).map(({ option, index }) => <button key={index} type="button" aria-pressed={selected.includes(index)} disabled={confirmed || answerLocked || seconds === 0} onClick={() => setSelected((current) => question.type === "TRUE_FALSE" ? [index] : current.includes(index) ? current.filter((choice) => choice !== index) : [...current, index])} className={`answer-card ${answerTones[index % answerTones.length]} flex min-h-[62px] items-center gap-3 rounded-xl border px-4 text-left text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 ${selected.includes(index) ? "answer-selected" : ""}`}><span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/20 bg-black/10 text-[11px] font-bold">{String.fromCharCode(65 + index)}</span><span className="flex-1">{option}</span>{selected.includes(index) && <Check className="size-4" />}</button>)}</div>}
          {question.type !== "IDENTIFICATION" && <button type="button" onClick={() => sendAnswer(selected)} disabled={!selected.length || answerLocked || seconds === 0 || isSubmitting} className={`${primaryButtonClass} mx-auto mt-4 w-full max-w-3xl`}>{confirmed ? "Submit answer" : "Confirm answer"}<Check className="size-4" /></button>}
          <p role="status" className="mt-4 min-h-5 text-center text-xs text-white/45">{message || (question.type === "MULTIPLE_CHOICE" ? "Select every answer you think is correct." : "Your answer locks when submitted or when time runs out.")}</p>
          <div className="mt-5 flex items-center justify-between border-t border-white/[0.07] pt-4 text-xs text-white/40"><span>{currentPlayer?.nickname ?? "Player"}</span><span>{currentPlayer?.score.toLocaleString() ?? 0} pts</span></div>
        </div> : <div className={`${surfaceClass} p-8 text-center text-sm text-white/45`}>No active question is available.</div>}
        <div className="mt-5 flex justify-center"><Link href={`/room/${code}/join`} className="rounded-full border border-white/[0.08] px-4 py-2 text-xs text-white/45 transition hover:border-[#ffd169]/30 hover:text-[#ffdc8b]">Room waiting area <ArrowRight className="ml-2 inline size-3.5" /></Link></div>
      </section>
    </QuizShell>
  )
}
