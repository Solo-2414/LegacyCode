import { HostRoomPage } from "@/components/pages/host-room-page"

export default async function HostRoomRoute({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  return <HostRoomPage code={code} />
}