import { LeaderboardPage } from "@/components/pages/leaderboard-page"

export default async function LeaderboardRoute({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  return <LeaderboardPage code={code} />
}
