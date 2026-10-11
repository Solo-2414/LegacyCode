import type { TeamStanding } from "@/lib/game-types"

export function TeamRows({ teams, myTeamName }: { teams: TeamStanding[]; myTeamName?: string }) {
  return (
    <ol className="divide-y divide-white/[0.06]">
      {teams.map((team, index) => (
        <li key={team.name} className="flex items-center gap-3 py-3">
          <span className={`w-7 text-center text-sm font-bold ${index === 0 ? "text-[#ffd169]" : "text-white/40"}`}>{index + 1}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-white/80">
              {team.name}
              {myTeamName && team.name === myTeamName ? <span className="ml-2 text-[10px] text-[#72edce]">Your team</span> : null}
            </span>
            <span className="block text-[10px] text-white/35">{team.playerCount} {team.playerCount === 1 ? "player" : "players"} · avg {team.average.toLocaleString()} pts</span>
          </span>
          <span className="text-sm font-bold tabular-nums text-white">{team.score.toLocaleString()} <span className="text-[10px] font-medium text-white/35">pts</span></span>
        </li>
      ))}
      {teams.length === 0 && <li className="py-6 text-center text-sm text-white/40">No teams yet.</li>}
    </ol>
  )
}

export type StandingsView = "players" | "teams"

export function StandingsToggle({ view, onChange }: { view: StandingsView; onChange: (view: StandingsView) => void }) {
  const base = "rounded-md px-3 py-1.5 text-[11px] font-semibold transition"
  return (
    <div role="tablist" aria-label="Standings view" className="inline-flex rounded-lg border border-white/[0.08] bg-black/20 p-0.5">
      <button type="button" role="tab" aria-selected={view === "players"} onClick={() => onChange("players")} className={`${base} ${view === "players" ? "bg-white/[0.1] text-white" : "text-white/45 hover:text-white/70"}`}>Players</button>
      <button type="button" role="tab" aria-selected={view === "teams"} onClick={() => onChange("teams")} className={`${base} ${view === "teams" ? "bg-white/[0.1] text-white" : "text-white/45 hover:text-white/70"}`}>Teams</button>
    </div>
  )
}
