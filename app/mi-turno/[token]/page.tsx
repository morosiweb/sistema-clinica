import { MiTurnoPanel } from "@/components/mi-turno-panel";

export const instant = false;

export default async function MiTurnoPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ reprogramar?: string }>;
}) {
  const { token } = await params;
  const { reprogramar } = await searchParams;
  const turnoInicialId =
    typeof reprogramar === "string" &&
    /^[a-zA-Z0-9_-]{1,100}$/.test(reprogramar)
      ? reprogramar
      : "";
  return <MiTurnoPanel token={token} turnoInicialId={turnoInicialId} />;
}
