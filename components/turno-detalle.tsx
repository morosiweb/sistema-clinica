"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  HistoriaClinica,
  type EntradaHistoria,
} from "@/components/historia-clinica";
import { RevisionesClinicas } from "@/components/revisiones-clinicas";
import { FichaMedica } from "@/components/ficha-medica";

type Historial = {
  id: string;
  accion: string;
  realizadoPor: string;
  detalle: string | null;
  fecha: string;
};

export type TurnoDetalleData = {
  id: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  estado: string;
  requiereReprogramacion?: boolean;
  motivoConsulta: string | null;
  notasSecretaria: string | null;
  notasMedico: string | null;
  version: number;
  paciente: {
    id: string;
    nombre: string;
    apellido: string;
    dni: string;
    telefono: string | null;
    versionFicha: number;
    pesoKg: number | null;
    alturaCm: number | null;
    grupoSanguineo: string | null;
    alergias: string | null;
    antecedentes: string | null;
  };
  medico: {
    nombre: string;
    apellido: string;
    especialidad: { nombre: string };
  };
  historial: Historial[];
};

const ESTADOS = [
  "PENDIENTE",
  "CONFIRMADO",
  "CANCELADO",
  "AUSENTE",
  "ATENDIDO",
] as const;

export function TurnoDetalle({
  turno,
  esMedico,
  puedeVerNotasMedico,
  historiaPaciente,
}: {
  turno: TurnoDetalleData;
  esMedico: boolean;
  // ADMIN o el propio médico tratante. Secretaria no accede al contenido
  // clínico, solo sabe que existe (ver lib/historia.ts).
  puedeVerNotasMedico: boolean;
  historiaPaciente: EntradaHistoria[];
}) {
  const router = useRouter();
  const [estado, setEstado] = useState(turno.estado);
  const [notasSecretaria, setNotasSecretaria] = useState(
    turno.notasSecretaria ?? "",
  );
  const [notasMedico, setNotasMedico] = useState(turno.notasMedico ?? "");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const inputClass =
    "w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800";

  async function guardar() {
    try {
      setError(null);
      setGuardando(true);
      const res = await fetch(`/api/turnos/${turno.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estado,
          notasSecretaria,
          notasMedico,
          version: turno.version,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(
          body?.error && typeof body.error === "string"
            ? body.error
            : "No se pudo guardar.",
        );
        return;
      }
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "No se pudo conectar. Intentá nuevamente.",
      );
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="clinical-detail space-y-6">
      {turno.requiereReprogramacion && (
        <p className="notice">
          Turno por reprogramar debido a una licencia del profesional.
        </p>
      )}
      <div className="consultation-summary">
        <p className="font-medium">
          {turno.paciente.apellido}, {turno.paciente.nombre} · DNI{" "}
          {turno.paciente.dni}
        </p>
        {turno.paciente.telefono && (
          <p className="text-neutral-500">{turno.paciente.telefono}</p>
        )}
        <p className="mt-2 text-neutral-500">
          {turno.medico.apellido}, {turno.medico.nombre} ·{" "}
          {turno.medico.especialidad.nombre}
        </p>
        <p className="text-neutral-500">
          {new Date(turno.fecha).toLocaleDateString("es-AR", {
            timeZone: "UTC",
          })}{" "}
          · {turno.horaInicio}–{turno.horaFin}
        </p>
        {turno.motivoConsulta && (
          <p className="mt-2">Motivo: {turno.motivoConsulta}</p>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="turno-detalle-campo-1" className="text-sm font-medium">
          Estado
        </label>
        <select
          id="turno-detalle-campo-1"
          className={inputClass}
          value={estado}
          onChange={(e) => setEstado(e.target.value)}
        >
          {ESTADOS.map((e) => (
            <option key={e} value={e}>
              {
                {
                  PENDIENTE: "Pendiente",
                  CONFIRMADO: "Confirmado",
                  CANCELADO: "Cancelado",
                  AUSENTE: "Ausente",
                  ATENDIDO: "Atendido",
                }[e]
              }
            </option>
          ))}
        </select>
      </div>

      {!esMedico && (
        <div className="space-y-1">
          <label
            htmlFor="turno-detalle-campo-2"
            className="text-sm font-medium"
          >
            Notas de secretaría
          </label>
          <textarea
            id="turno-detalle-campo-2"
            className={inputClass}
            rows={3}
            value={notasSecretaria}
            onChange={(e) => setNotasSecretaria(e.target.value)}
          />
        </div>
      )}

      {esMedico && (
        <div className="space-y-1">
          <label
            htmlFor="turno-detalle-campo-3"
            className="text-sm font-medium"
          >
            Notas clínicas (médico)
          </label>
          <textarea
            id="turno-detalle-campo-3"
            className={inputClass}
            rows={3}
            value={notasMedico}
            onChange={(e) => setNotasMedico(e.target.value)}
          />
        </div>
      )}
      {!esMedico && puedeVerNotasMedico && turno.notasMedico && (
        <div className="space-y-1">
          <label className="text-sm font-medium">Notas clínicas (médico)</label>
          <p className="rounded-md bg-neutral-50 p-3 text-sm text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
            {turno.notasMedico}
          </p>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        onClick={guardar}
        disabled={guardando}
        className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
      >
        {guardando ? "Guardando..." : "Guardar cambios"}
      </button>

      {puedeVerNotasMedico && (
        <RevisionesClinicas
          tipo="notas"
          id={turno.id}
          version={turno.version}
        />
      )}
      <div>
        <h2 className="mb-2 text-sm font-semibold">Historial</h2>
        <div className="space-y-1 text-xs text-neutral-500">
          {turno.historial.map((h) => (
            <p key={h.id}>
              {new Date(h.fecha).toLocaleString("es-AR")} · {h.accion} ·{" "}
              {h.realizadoPor}
              {h.detalle ? ` · ${h.detalle}` : ""}
            </p>
          ))}
        </div>
      </div>

      {historiaPaciente.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold">
            {esMedico
              ? "Otras consultas con este paciente"
              : "Historia clínica del paciente"}
          </h2>
          <HistoriaClinica
            key={`${turno.id}:${turno.version}`}
            entradas={historiaPaciente}
            pacienteId={turno.paciente.id}
            excluirTurnoId={turno.id}
          />
        </div>
      )}

      {puedeVerNotasMedico && (
        <FichaMedica
          key={`${turno.paciente.id}:${turno.paciente.versionFicha}`}
          puedeRegistrarVisita={esMedico}
          pacienteId={turno.paciente.id}
          inicial={{
            versionFicha: turno.paciente.versionFicha,
            pesoKg: turno.paciente.pesoKg,
            alturaCm: turno.paciente.alturaCm,
            grupoSanguineo: turno.paciente.grupoSanguineo,
            alergias: turno.paciente.alergias,
            antecedentes: turno.paciente.antecedentes,
          }}
        />
      )}
    </div>
  );
}
