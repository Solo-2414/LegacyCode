"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Activity, BarChart3, Check, Crown, Database, HeartPulse, Pencil, Plus, Shield, Trash2, Users, X } from "lucide-react"
import { PageHeading, QuizShell, fieldClass, primaryButtonClass, secondaryButtonClass, surfaceClass } from "@/components/quiz-shell"
import { QuizBuilder, type SavedQuiz } from "@/components/pages/quiz-builder"
import { API_URL } from "@/lib/quiz-api"
import type { UserSession } from "@/lib/auth-session"

type DashboardData = {
  stats: { total_users: number; admin_users: number; superadmin_users: number; participant_users: number; total_quizzes: number; total_rooms: number; active_rooms: number; live_players: number; questions_answered_today: number }
  activity: Array<{ date: string; answers: number; players: number }>
  users: Array<{ id: string; email: string; name: string; role: "SUPERADMIN" | "ADMIN" | "PARTICIPANT"; created_at: string }>
  quizzes: Array<{ id: string; title: string; description: string | null; host_name: string; round_count: number; question_count: number; updated_at: string }>
  rooms: Array<{ id: string; room_code: string; status: string; quiz_title: string; host_name: string; participant_count: number; created_at: string }>
}

type Tab = "overview" | "users" | "quizzes" | "rooms"

async function apiRequest<T>(path: string, options?: RequestInit) {
  const response = await fetch(`${API_URL}${path}`, { ...options, credentials: "include", headers: { "Content-Type": "application/json", ...options?.headers }, cache: "no-store" })
  if (!response.ok) {
    const result = await response.json().catch(() => ({})) as { error?: string }
    throw new Error(result.error ?? `Request failed (${response.status}).`)
  }
  return response.status === 204 ? undefined as T : await response.json() as T
}

export function SuperAdminDashboard() {
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [tab, setTab] = useState<Tab>("overview")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState("")
  const [builderQuiz, setBuilderQuiz] = useState<SavedQuiz | undefined>()
  const [editingQuiz, setEditingQuizState] = useState<{ id: string; title: string; description: string } | null>(null)
  const [userModalOpen, setUserModalOpen] = useState(false)
  const [roomToClose, setRoomToClose] = useState<string | null>(null)
  const [newUser, setNewUser] = useState({ email: "", name: "", password: "", role: "PARTICIPANT" as DashboardData["users"][number]["role"] })

  async function refresh() {
    setError("")
    try {
      setData(await apiRequest<DashboardData>("/api/superadmin/overview"))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load the super-admin dashboard.")
    }
  }

  useEffect(() => {
    void fetch("/api/auth/session", { cache: "no-store" }).then((response) => response.json()).then((result: { session?: UserSession }) => {
      if (result.session?.role !== "SUPERADMIN") {
        router.replace(result.session?.role === "ADMIN" ? "/admin/dashboard" : "/")
        return
      }
      void refresh()
    }).catch(() => router.replace("/"))
  }, [router])

  async function updateUser(id: string, role: DashboardData["users"][number]["role"]) {
    setBusy(id)
    try { await apiRequest(`/api/superadmin/users/${id}`, { method: "PATCH", body: JSON.stringify({ role }) }); await refresh() } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not update user.") } finally { setBusy("") }
  }

  async function deleteUser(id: string) {
    if (!window.confirm("Delete this user and their hosted data?")) return
    setBusy(id)
    try { await apiRequest(`/api/superadmin/users/${id}`, { method: "DELETE" }); await refresh() } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not delete user.") } finally { setBusy("") }
  }

  async function openQuizBuilder(id: string) {
    try {
      const quizzes = await apiRequest<SavedQuiz[]>("/api/quizzes")
      setBuilderQuiz(quizzes.find((quiz) => quiz.id === id))
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load quiz.") }
  }

  function setEditingQuiz(quiz: { id: string; title: string; description: string } | null) {
    if (quiz) void openQuizBuilder(quiz.id)
    else setEditingQuizState(null)
  }

  async function saveFullQuiz(quiz: SavedQuiz) {
    setBusy(quiz.id)
    try { await apiRequest<SavedQuiz>("/api/quizzes", { method: "POST", body: JSON.stringify(quiz) }); setBuilderQuiz(undefined); await refresh() } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save quiz.") } finally { setBusy("") }
  }

  async function createUser() {
    setBusy("create-user")
    try { await apiRequest("/api/superadmin/users", { method: "POST", body: JSON.stringify(newUser) }); setNewUser({ email: "", name: "", password: "", role: "PARTICIPANT" }); setUserModalOpen(false); await refresh() } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not create user.") } finally { setBusy("") }
  }

  async function deleteQuiz(id: string) {
    if (!window.confirm("Force delete this quiz and its rooms?")) return
    setBusy(id)
    try { await apiRequest(`/api/superadmin/quizzes/${id}`, { method: "DELETE" }); await refresh() } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not delete quiz.") } finally { setBusy("") }
  }

  async function closeRoom(code: string) {
    setRoomToClose(code)
  }

  async function confirmCloseRoom() {
    if (!roomToClose) return
    const code = roomToClose
    setRoomToClose(null)
    setBusy(code)
    try { await apiRequest(`/api/superadmin/rooms/${code}/close`, { method: "POST" }); await refresh() } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not close room.") } finally { setBusy("") }
  }

  if (!data) return <QuizShell><div className="mx-auto max-w-[1200px] py-16 text-center text-sm text-white/45">{error || "Loading platform data..."}</div></QuizShell>
  const tabs: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [{ id: "overview", label: "Overview", icon: <BarChart3 className="size-4" /> }, { id: "users", label: "Users", icon: <Users className="size-4" /> }, { id: "quizzes", label: "Quizzes", icon: <Database className="size-4" /> }, { id: "rooms", label: "Active rooms", icon: <Shield className="size-4" /> }]

  return <QuizShell>
    <section className="mx-auto max-w-[1200px]" aria-labelledby="superadmin-title">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><PageHeading id="superadmin-title" eyebrow="Platform command" title={<>Super admin <span className="text-gradient">overview.</span></>} description="Monitor the whole quiz platform and manage its data from one place." /><span className="mb-8 inline-flex w-fit items-center gap-2 rounded-lg border border-[#ffd169]/25 bg-[#ffd169]/[0.08] px-3 py-2 text-xs font-semibold text-[#ffdc8b]"><Crown className="size-4" /> Global access</span></div>
      {error && <p role="alert" className="mb-5 rounded-lg border border-[#fa718d]/20 bg-[#fa718d]/[0.07] px-4 py-3 text-sm text-[#ffa0b1]">{error}</p>}
      <nav className="mb-6 flex w-full gap-1 overflow-x-auto rounded-lg border border-white/[0.08] bg-[#111722] p-1" aria-label="Super admin sections">{tabs.map((item) => <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-md px-4 py-3 text-xs font-semibold transition ${tab === item.id ? "bg-[#10d7ac]/[0.13] text-[#72edce]" : "text-white/45 hover:text-white"}`}>{item.icon}{item.label}</button>)}</nav>
      {builderQuiz ? <div className={`${surfaceClass} p-5 sm:p-7`}><button type="button" onClick={() => setBuilderQuiz(undefined)} className={`${secondaryButtonClass} mb-6`}><X className="size-4" /> Back to quizzes</button><QuizBuilder quiz={builderQuiz} onCancel={() => setBuilderQuiz(undefined)} onSave={saveFullQuiz} /></div> : <>{tab === "overview" && <Overview data={data} />}{tab === "users" && <UsersTable data={data} busy={busy} onRoleChange={updateUser} onDelete={deleteUser} onCreate={() => setUserModalOpen(true)} />}{tab === "quizzes" && <QuizzesTable data={data} busy={busy} editingQuiz={editingQuiz} setEditingQuiz={setEditingQuiz} onSave={() => undefined} onEdit={openQuizBuilder} onDelete={deleteQuiz} />}{tab === "rooms" && <RoomsTable data={data} busy={busy} onClose={closeRoom} />}</>}
      {userModalOpen && <CreateUserModal user={newUser} busy={busy === "create-user"} onChange={setNewUser} onCancel={() => setUserModalOpen(false)} onSubmit={() => void createUser()} />}
      {roomToClose && <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"><section role="dialog" aria-modal="true" aria-labelledby="end-room-title" className={`${surfaceClass} w-full max-w-md p-6`}><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#ffa0b1]">End live session</p><h2 id="end-room-title" className="mt-1 text-lg font-bold text-white">Close room {roomToClose}?</h2><p className="mt-2 text-sm leading-6 text-white/45">Players will no longer be able to submit answers in this room.</p></div><button type="button" onClick={() => setRoomToClose(null)} className={secondaryButtonClass} aria-label="Cancel end session"><X className="size-4" /></button></div><div className="mt-6 flex justify-end gap-2 border-t border-white/[0.08] pt-4"><button type="button" onClick={() => setRoomToClose(null)} className={secondaryButtonClass}>Cancel</button><button type="button" onClick={() => void confirmCloseRoom()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#fa718d] px-5 py-3 text-sm font-bold text-[#2a0b13] transition hover:bg-[#ff91a4]">End session</button></div></section></div>}
    </section>
  </QuizShell>
}

function Overview({ data }: { data: DashboardData }) {
  const cards = [
    { label: "Live players", value: data.stats.live_players, detail: "Connected in lobby or live rooms", icon: <Users className="size-4" /> },
    { label: "Active sessions", value: data.stats.active_rooms, detail: "Rooms currently in progress", icon: <Activity className="size-4" /> },
    { label: "Questions answered", value: data.stats.questions_answered_today, detail: "Submissions recorded today", icon: <Database className="size-4" /> },
    { label: "System status", value: "Healthy", detail: "Database telemetry responding", icon: <HeartPulse className="size-4" /> },
  ]
  return <><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map((card) => <div key={card.label} className={`${surfaceClass} p-5`}><span className="flex size-9 items-center justify-center rounded-lg bg-[#10d7ac]/[0.09] text-[#72edce]">{card.icon}</span><p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">{card.label}</p><p className="mt-1 flex items-center gap-2 text-3xl font-bold text-white">{card.label === "System status" && <span className="size-2.5 rounded-full bg-[#10d7ac] shadow-[0_0_12px_#10d7ac]" />}{card.value}</p><p className="mt-2 text-xs text-white/40">{card.detail}</p></div>)}</div><div className={`${surfaceClass} mt-5 p-5 sm:p-7`}><div className="mb-6 flex items-center justify-between gap-3"><div><h2 className="text-base font-bold text-white">Real-time engagement</h2><p className="mt-1 text-xs text-white/40">Answers submitted and players active over the last hour</p></div><BarChart3 className="size-5 text-[#72edce]" /></div><div className="h-[280px] w-full"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data.activity}><defs><linearGradient id="answersFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10d7ac" stopOpacity={0.35} /><stop offset="95%" stopColor="#10d7ac" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="#ffffff12" vertical={false} /><XAxis dataKey="date" tick={{ fill: "#ffffff66", fontSize: 11 }} tickFormatter={(value: string) => value.slice(11, 16)} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={{ fill: "#ffffff66", fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ background: "#111722", border: "1px solid #ffffff1a", borderRadius: 8, color: "#fff" }} /><Area type="monotone" dataKey="answers" name="Answers" stroke="#10d7ac" fill="url(#answersFill)" strokeWidth={2} /><Area type="monotone" dataKey="players" name="Players" stroke="#4cbce0" fill="none" strokeWidth={2} /></AreaChart></ResponsiveContainer></div></div></>
}

function UsersTable({ data, busy, onRoleChange, onDelete, onCreate }: { data: DashboardData; busy: string; onRoleChange: (id: string, role: DashboardData["users"][number]["role"]) => void; onDelete: (id: string) => void; onCreate: () => void }) {
  return <><div className="mb-3 flex justify-end"><button type="button" onClick={onCreate} className={primaryButtonClass}><Plus className="size-4" /> Create user</button></div><ManagementFrame title="Global users" description="Manage platform access and account roles."><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="text-[10px] uppercase tracking-[0.12em] text-white/35"><tr><th className="px-4 py-3">User</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Created</th><th className="px-4 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-white/[0.06]">{data.users.map((user) => <tr key={user.id}><td className="px-4 py-4"><p className="font-semibold text-white/85">{user.name}</p><p className="mt-1 text-xs text-white/35">{user.email}</p></td><td className="px-4 py-4"><select value={user.role} disabled={busy === user.id} onChange={(event) => onRoleChange(user.id, event.target.value as DashboardData["users"][number]["role"])} className="rounded-lg border border-white/[0.1] bg-[#111722] px-3 py-2 text-xs text-white"><option value="SUPERADMIN">Super admin</option><option value="ADMIN">Admin</option><option value="PARTICIPANT">Participant</option></select></td><td className="px-4 py-4 text-xs text-white/40">{new Date(user.created_at).toLocaleDateString()}</td><td className="px-4 py-4 text-right"><button type="button" onClick={() => onDelete(user.id)} disabled={busy === user.id} className="inline-flex size-9 items-center justify-center rounded-lg text-[#ffa0b1] hover:bg-[#fa718d]/10" aria-label={`Delete ${user.email}`}><Trash2 className="size-4" /></button></td></tr>)}</tbody></table></div></ManagementFrame></>
}

function QuizzesTable({ data, busy, editingQuiz, setEditingQuiz, onSave, onEdit, onDelete }: { data: DashboardData; busy: string; editingQuiz: { id: string; title: string; description: string } | null; setEditingQuiz: (quiz: { id: string; title: string; description: string } | null) => void; onSave: () => void; onEdit: (id: string) => void; onDelete: (id: string) => void }) {
  return <ManagementFrame title="Global quizzes" description="Review, edit, or force-delete quiz content."><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="text-[10px] uppercase tracking-[0.12em] text-white/35"><tr><th className="px-4 py-3">Quiz</th><th className="px-4 py-3">Host</th><th className="px-4 py-3">Content</th><th className="px-4 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-white/[0.06]">{data.quizzes.map((quiz) => <tr key={quiz.id}><td className="px-4 py-4">{editingQuiz?.id === quiz.id ? <div className="flex gap-2"><input className={fieldClass} value={editingQuiz.title} onChange={(event) => setEditingQuiz({ ...editingQuiz, title: event.target.value })} /><input className={fieldClass} value={editingQuiz.description} onChange={(event) => setEditingQuiz({ ...editingQuiz, description: event.target.value })} placeholder="Description" /></div> : <><p className="font-semibold text-white/85">{quiz.title}</p><p className="mt-1 text-xs text-white/35">{quiz.description || "No description"}</p></>}</td><td className="px-4 py-4 text-xs text-white/55">{quiz.host_name}</td><td className="px-4 py-4 text-xs text-white/40">{quiz.round_count} rounds · {quiz.question_count} questions</td><td className="px-4 py-4 text-right"><div className="flex justify-end gap-1">{editingQuiz?.id === quiz.id ? <><button type="button" onClick={onSave} className="inline-flex size-9 items-center justify-center rounded-lg text-[#72edce] hover:bg-[#10d7ac]/10" aria-label="Save quiz"><Check className="size-4" /></button><button type="button" onClick={() => setEditingQuiz(null)} className="inline-flex size-9 items-center justify-center rounded-lg text-white/45 hover:bg-white/[0.06]" aria-label="Cancel edit"><X className="size-4" /></button></> : <button type="button" onClick={() => setEditingQuiz({ id: quiz.id, title: quiz.title, description: quiz.description ?? "" })} className="inline-flex size-9 items-center justify-center rounded-lg text-white/55 hover:bg-white/[0.06]" aria-label={`Edit ${quiz.title}`}><Pencil className="size-4" /></button>}<button type="button" onClick={() => onDelete(quiz.id)} disabled={busy === quiz.id} className="inline-flex size-9 items-center justify-center rounded-lg text-[#ffa0b1] hover:bg-[#fa718d]/10" aria-label={`Delete ${quiz.title}`}><Trash2 className="size-4" /></button></div></td></tr>)}</tbody></table></div></ManagementFrame>
}

function RoomsTable({ data, busy, onClose }: { data: DashboardData; busy: string; onClose: (code: string) => void }) {
  return <ManagementFrame title="Room sessions" description="Inspect live sessions and end rooms that are stuck."><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="text-[10px] uppercase tracking-[0.12em] text-white/35"><tr><th className="px-4 py-3">Room</th><th className="px-4 py-3">Quiz / host</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Players</th><th className="px-4 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-white/[0.06]">{data.rooms.map((room) => <tr key={room.id}><td className="px-4 py-4 font-mono text-sm text-white/80">{room.room_code}</td><td className="px-4 py-4"><p className="font-semibold text-white/80">{room.quiz_title}</p><p className="mt-1 text-xs text-white/35">{room.host_name}</p></td><td className="px-4 py-4"><span className={`rounded-lg px-2 py-1 text-[10px] font-semibold ${room.status === "IN_PROGRESS" ? "bg-[#10d7ac]/10 text-[#72edce]" : "bg-white/[0.06] text-white/45"}`}>{room.status}</span></td><td className="px-4 py-4 text-xs text-white/45">{room.participant_count}</td><td className="px-4 py-4 text-right"><button type="button" onClick={() => onClose(room.room_code)} disabled={busy === room.room_code || room.status === "COMPLETED"} className={secondaryButtonClass}>End session</button></td></tr>)}</tbody></table></div></ManagementFrame>
}

function CreateUserModal({ user, busy, onChange, onCancel, onSubmit }: { user: { email: string; name: string; password: string; role: DashboardData["users"][number]["role"] }; busy: boolean; onChange: (user: { email: string; name: string; password: string; role: DashboardData["users"][number]["role"] }) => void; onCancel: () => void; onSubmit: () => void }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"><section role="dialog" aria-modal="true" aria-labelledby="create-user-title" className={`${surfaceClass} w-full max-w-lg p-6 sm:p-7`}><div className="mb-6 flex items-start justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#62e8cb]">Platform access</p><h2 id="create-user-title" className="mt-1 text-lg font-bold text-white">Create user</h2></div><button type="button" onClick={onCancel} className={secondaryButtonClass} aria-label="Close create user dialog"><X className="size-4" /></button></div><form onSubmit={(event) => { event.preventDefault(); onSubmit() }} className="space-y-4"><label className="flex flex-col gap-2 text-xs font-semibold text-white/65">Email<input className={fieldClass} type="email" value={user.email} onChange={(event) => onChange({ ...user, email: event.target.value })} required /></label><label className="flex flex-col gap-2 text-xs font-semibold text-white/65">Display name<input className={fieldClass} value={user.name} onChange={(event) => onChange({ ...user, name: event.target.value })} required /></label><label className="flex flex-col gap-2 text-xs font-semibold text-white/65">Password<input className={fieldClass} type="password" minLength={12} value={user.password} onChange={(event) => onChange({ ...user, password: event.target.value })} required /><span className="text-[10px] font-normal text-white/35">Minimum 12 characters.</span></label><label className="flex flex-col gap-2 text-xs font-semibold text-white/65">Role<select className={fieldClass} value={user.role} onChange={(event) => onChange({ ...user, role: event.target.value as DashboardData["users"][number]["role"] })}><option value="PARTICIPANT">Participant</option><option value="ADMIN">Admin</option><option value="SUPERADMIN">Super admin</option></select></label><div className="flex justify-end gap-2 border-t border-white/[0.08] pt-4"><button type="button" onClick={onCancel} className={secondaryButtonClass}>Cancel</button><button type="submit" disabled={busy} className={primaryButtonClass}>{busy ? "Creating..." : "Create user"}</button></div></form></section></div>
}

function ManagementFrame({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <div className={`${surfaceClass} overflow-hidden`}><div className="border-b border-white/[0.07] px-5 py-5 sm:px-6"><h2 className="text-base font-bold text-white">{title}</h2><p className="mt-1 text-xs text-white/40">{description}</p></div>{children}</div>
}
