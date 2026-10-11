"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"
import Link from "next/link"
import type { UserSession } from "@/lib/auth-session"
import { clearApiToken } from "@/lib/api-token"
import { resetRealtimeSocket } from "@/lib/realtime"

export function AuthenticatedNav() {
  const router = useRouter()
  const [session, setSession] = useState<UserSession | null>(null)

  useEffect(() => {
    fetch("/api/auth/session", { cache: "no-store" })
      .then((response) => response.json())
      .then((result: { session: UserSession | null }) => setSession(result.session))
      .catch(() => setSession(null))
  }, [])

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" })
    clearApiToken()
    resetRealtimeSocket()
    router.replace("/")
    router.refresh()
  }

  if (!session) return null

  return (
    <nav aria-label="Account navigation" className="flex items-center gap-2">
      <Link href={session.role === "SUPERADMIN" ? "/superadmin" : session.role === "ADMIN" ? "/admin/dashboard" : "/join"} className="rounded-lg border border-white/[0.08] bg-white/[0.035] px-3 py-2 text-xs font-medium text-white/65 transition hover:border-[#10d7ac]/30 hover:bg-[#10d7ac]/[0.08] hover:text-white">
        {session.role === "SUPERADMIN" ? "Platform dashboard" : session.role === "ADMIN" ? "Host dashboard" : "Join a room"}
      </Link>
      <span className="hidden max-w-36 truncate text-xs text-white/40 sm:inline" title={session.name}>{session.name}</span>
      <button type="button" onClick={() => void signOut()} aria-label="Sign out" title="Sign out" className="inline-flex size-10 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.035] text-white/55 transition hover:border-[#fa718d]/30 hover:bg-[#fa718d]/[0.08] hover:text-[#ffa0b1]"><LogOut className="size-4" /></button>
    </nav>
  )
}
