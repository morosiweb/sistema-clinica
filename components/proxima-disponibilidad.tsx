"use client";
import { useState } from "react";
import { fetchJSON, mensajeError } from "@/lib/cliente";
export function ProximaDisponibilidad({
  medicoId,
  fecha,
  interno = false,
  onElegir,
}: {
  medicoId: string;
  fecha: string;
  interno?: boolean;
  onElegir: (fecha: string, hora: string) => void;
}) {
  const [ocupado, setOcupado] = useState(false),
    [mensaje, setMensaje] = useState("");
  async function buscar() {
    setOcupado(true);
    setMensaje("");
    try {
      const data = await fetchJSON<{
        proxima: { fecha: string; horaInicio: string } | null;
      }>(
        `${interno ? "/api" : "/api/publico"}/disponibilidad?${new URLSearchParams({ medicoId, fecha, proxima: "1" })}`,
      );
      if (!data.proxima)
        setMensaje(
          "No hay lugares disponibles en los próximos 60 días desde la fecha elegida.",
        );
      else {
        onElegir(data.proxima.fecha, data.proxima.horaInicio);
        setMensaje(
          `Próximo lugar: ${new Date(`${data.proxima.fecha}T12:00:00Z`).toLocaleDateString("es-AR", { timeZone: "UTC" })} a las ${data.proxima.horaInicio}.`,
        );
      }
    } catch (e) {
      setMensaje(mensajeError(e));
    } finally {
      setOcupado(false);
    }
  }
  return (
    <div className="space-y-2">
      <button
        type="button"
        className="btn btn-outline btn-small"
        disabled={ocupado || !medicoId || !fecha}
        onClick={() => {
          void buscar();
        }}
      >
        {ocupado ? "Buscando lugares…" : "Ver próxima disponibilidad"}
      </button>
      {mensaje && (
        <p role="status" className="text-sm">
          {mensaje}
        </p>
      )}
    </div>
  );
}
