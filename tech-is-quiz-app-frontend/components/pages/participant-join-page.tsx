"use client"

import { useEffect, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Hash } from "lucide-react"
import { REMOVED_NOTICE_KEY } from "@/lib/kicked"
import { PageHeading, QuizShell, fieldClass, primaryButtonClass, surfaceClass } from "@/components/quiz-shell"

export function ParticipantJoinPage() {
  const router = useRouter()
  const [code, setCode] = useState("")
  const [notice, setNotice] = useState("")

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(REMOVED_NOTICE_KEY)
      if (stored) { setNotice(stored); window.sessionStorage.removeItem(REMOVED_NOTICE_KEY) }
    } catch { /* storage unavailable */ }
  }, [])

  function continueToRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (/^\d{6}$/.test(code)) router.push(`/room/${code}/join`)
  }

  return (
    <QuizShell>
      <section className="mx-auto flex min-h-[calc(100svh-230px)] max-w-[600px] items-center" aria-labelledby="join-room-title">
        <div className={`${surfaceClass} w-full p-6 sm:p-8`}>
          <PageHeading id="join-room-title" eyebrow="Participant space" title={<>Ready to <span className="text-gradient">play?</span></>} description="Enter the six-digit room code from your host." />
          {notice && <p role="alert" className="mb-4 rounded-xl border border-[#fa718d]/20 bg-[#fa718d]/[0.07] px-4 py-3 text-sm text-[#ffa0b1]">{notice}</p>}
          <form onSubmit={continueToRoom} className="flex flex-col gap-4">
            <label htmlFor="room-code" className="flex flex-col gap-2 text-xs font-semibold text-white/65">Room code<span className="relative"><Hash className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-white/35" /><input id="room-code" className={`${fieldClass} pl-11 text-base tracking-[0.2em]`} inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" placeholder="000000" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} required /></span></label>
            <button type="submit" disabled={code.length !== 6} className={`${primaryButtonClass} w-full hover:scale-[1.01]`}>Continue <ArrowRight className="size-4" /></button>
          </form>
        </div>
      </section>
    </QuizShell>
  )
}
