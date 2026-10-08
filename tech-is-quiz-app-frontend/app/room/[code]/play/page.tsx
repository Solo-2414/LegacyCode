import { GameplayPage } from "@/components/pages/gameplay-page"

export default async function GameplayRoute({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  return <GameplayPage code={code} />
}
