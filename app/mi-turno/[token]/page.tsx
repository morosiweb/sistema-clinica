import { MiTurnoPanel } from "@/components/mi-turno-panel";

export const instant = false;

export default async function MiTurnoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <MiTurnoPanel token={token} />;
}
