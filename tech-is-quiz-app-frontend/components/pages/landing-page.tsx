"use client"

import { clearApiToken } from "@/lib/api-token"
import { resetRealtimeSocket } from "@/lib/realtime"
import { useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, KeyRound, LockKeyhole, Mail } from "lucide-react"
import { QuizShell, fieldClass, primaryButtonClass, surfaceClass } from "@/components/quiz-shell"
import type { UserSession } from "@/lib/auth-session"

export function LandingPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setIsSubmitting(true)
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const result = await response.json() as { session?: UserSession; error?: string }
      if (!response.ok || !result.session) {
        setError(result.error ?? "Email or password is incorrect.")
        return
      }
      clearApiToken()
      resetRealtimeSocket()
      router.replace(result.session.role === "SUPERADMIN" ? "/superadmin" : result.session.role === "ADMIN" ? "/admin/dashboard" : "/join")
      router.refresh()
    } catch {
      setError("Could not reach the sign-in service. Try again in a moment.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <QuizShell>
      <section className="mx-auto flex min-h-[calc(100svh-230px)] max-w-[500px] items-center justify-center" aria-labelledby="login-title">
        <div className={`${surfaceClass} w-full p-6 sm:p-9`}>
          <div className="mb-7 flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-[#10d7ac]/25 bg-[#10d7ac]/[0.09] text-[#72edce]"><LockKeyhole className="size-5" /></span>
            <div><p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#62e8cb]">TechIs QuizApp</p><h1 id="login-title" className="text-2xl font-bold tracking-tight text-white sm:text-[30px]">Welcome back.</h1><p className="mt-1.5 text-sm text-white/45">Sign in to continue to your quiz space.</p></div>
          </div>
          <form onSubmit={signIn} className="flex flex-col gap-4">
            <label htmlFor="email" className="flex flex-col gap-2 text-xs font-semibold text-white/65">Email address<span className="relative"><Mail className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-white/35" /><input id="email" className={`${fieldClass} pl-11 ${error ? "border-[#fa718d]/55 focus:border-[#fa718d]/70 focus:ring-[#fa718d]/15" : ""}`} type="email" autoComplete="username" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required /></span></label>
            <label htmlFor="password" className="flex flex-col gap-2 text-xs font-semibold text-white/65">Password<span className="relative"><KeyRound className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-white/35" /><input id="password" className={`${fieldClass} pl-11 ${error ? "border-[#fa718d]/55 focus:border-[#fa718d]/70 focus:ring-[#fa718d]/15" : ""}`} type="password" autoComplete="current-password" placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} required /></span></label>
            {error && <p role="alert" className="rounded-lg border border-[#fa718d]/20 bg-[#fa718d]/[0.07] px-3 py-2.5 text-xs text-[#ffa0b1]">{error}</p>}
            <button type="submit" disabled={isSubmitting} className={`${primaryButtonClass} mt-1 w-full hover:scale-[1.01]`}>{isSubmitting ? "Signing in…" : "Sign in"}<ArrowRight className="size-4" /></button>
          </form>
        </div>
      </section>
    </QuizShell>
  )
}
