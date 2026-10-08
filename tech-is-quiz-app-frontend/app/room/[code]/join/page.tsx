import { TeamJoinPage } from "@/components/pages/team-join-page"

export default async function TeamJoinRoute({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  return <TeamJoinPage code={code} />
}
