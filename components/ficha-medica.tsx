"use client";

import { AvisoBorrador } from "@/components/aviso-borrador";
import { useBorradorClinico } from "@/lib/borrador-clinico";
import {
  confirmarSalida,
  useCambiosSinGuardar,
} from "@/lib/cambios-sin-guardar";
import { MAX_NOTA_CLINICA } from "@/lib/estados-turno";
import { useState } from "react";
import { useHoy } from "@/lib/cliente";
import { RevisionesClinicas } from "@/components/revisiones-clinicas";
import { useRouter } from "next/navigation";

export type FichaMedicaData = {
  versionFicha: number;
  pesoKg: number | null;
  alturaCm: number | null;
  grupoSanguineo: string | null;
  alergias: string | null;
  antecedentes: string | null;
};

const inputClass =
  "w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800";

export function FichaMedica({
  pacienteId,
  inicial,
  puedeRegistrarVisita = true,
}: {
  pacienteId: string;
  inicial: FichaMedicaData;
  puedeRegistrarVisita?: boolean;
}) {
  const router = useRouter();
  const [version, setVersion] = useState(inicial.versionFicha);
  const [pesoKg, setPesoKg] = useState(inicial.pesoKg?.toString() ?? "");
  const [alturaCm, setAlturaCm] = useState(inicial.alturaCm?.toString() ?? "");
  const [grupoSanguineo, setGrupoSanguineo] = useState(
    inicial.grupoSanguineo ?? "",
  );
  const [alergias, setAlergias] = useState(inicial.alergias ?? "");
  const [antecedentes, setAntecedentes] = useState(inicial.antecedentes ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mostrarVisita, setMostrarVisita] = useState(false);
  const hoy = useHoy();
  const [diaVisita, setFechaVisita] = useState("");
  const fechaVisita = diaVisita || hoy;
  const [horaVisita, setHoraVisita] = useState("");
  const [motivoVisita, setMotivoVisita] = useState("");
  const [notasVisita, setNotasVisita] = useState("");
  const [guardandoVisita, setGuardandoVisita] = useState(false);
  const [errorVisita, setErrorVisita] = useState<string | null>(null);
  const fichaActual = {
    pesoKg,
    alturaCm,
    grupoSanguineo,
    alergias,
    antecedentes,
  };
  const [guardado, setGuardado] = useState(
    JSON.stringify({
      pesoKg: inicial.pesoKg?.toString() ?? "",
      alturaCm: inicial.alturaCm?.toString() ?? "",
      grupoSanguineo: inicial.grupoSanguineo ?? "",
      alergias: inicial.alergias ?? "",
      antecedentes: inicial.antecedentes ?? "",
    }),
  );
  const sucio = JSON.stringify(fichaActual) !== guardado;
  const visitaSucia =
    mostrarVisita && !!(diaVisita || horaVisita || motivoVisita || notasVisita);
  useCambiosSinGuardar(sucio || visitaSucia);
  const borrador = useBorradorClinico(
    "ficha",
    pacienteId,
    version,
    fichaActual,
    sucio,
  );
  const visita = useBorradorClinico(
    "visita",
    pacienteId,
    version,
    {
      fecha: fechaVisita,
      horaInicio: horaVisita,
      motivoConsulta: motivoVisita,
      notasMedico: notasVisita,
    },
    visitaSucia,
    puedeRegistrarVisita,
  );

  async function guardarFicha() {
    try {
      setError(null);
      setGuardando(true);
      const res = await fetch(`/api/pacientes/${pacienteId}/ficha-medica`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          versionFicha: version,
          pesoKg,
          alturaCm,
          grupoSanguineo,
          alergias,
          antecedentes,
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
      const actualizado = await res.json();
      setVersion(actualizado.versionFicha);
      setGuardado(JSON.stringify(fichaActual));
      await borrador.limpiar().catch(() => {});
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

  async function registrarVisita(e: React.FormEvent) {
    try {
      e.preventDefault();
      if (!horaVisita) {
        setErrorVisita("Elegí un horario.");
        return;
      }
      setErrorVisita(null);
      setGuardandoVisita(true);
      const res = await fetch(`/api/pacientes/${pacienteId}/visitas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha: fechaVisita,
          horaInicio: horaVisita,
          motivoConsulta: motivoVisita,
          notasMedico: notasVisita,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setErrorVisita(
          body?.error && typeof body.error === "string"
            ? body.error
            : "No se pudo registrar.",
        );
        return;
      }
      await visita.limpiar().catch(() => {});
      setMostrarVisita(false);
      setHoraVisita("");
      setMotivoVisita("");
      setNotasVisita("");
      router.refresh();
    } catch (error) {
      setErrorVisita(
        error instanceof Error
          ? error.message
          : "No se pudo conectar. Intentá nuevamente.",
      );
    } finally {
      setGuardandoVisita(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 text-sm font-semibold">Ficha médica</h2>
        <AvisoBorrador
          disponible={!!borrador.disponible}
          obsoleto={borrador.disponible?.versionBase !== version}
          estado={borrador.estado}
          restaurar={() => {
            const data = borrador.restaurar();
            if (data) {
              setPesoKg(data.pesoKg);
              setAlturaCm(data.alturaCm);
              setGrupoSanguineo(data.grupoSanguineo);
              setAlergias(data.alergias);
              setAntecedentes(data.antecedentes);
            }
          }}
          descartar={borrador.limpiar}
        />
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label
              htmlFor="ficha-medica-campo-1"
              className="text-xs text-neutral-500"
            >
              Peso (kg)
            </label>
            <input
              id="ficha-medica-campo-1"
              type="number"
              step="0.1"
              className={inputClass}
              value={pesoKg}
              onChange={(e) => setPesoKg(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label
              htmlFor="ficha-medica-campo-2"
              className="text-xs text-neutral-500"
            >
              Altura (cm)
            </label>
            <input
              id="ficha-medica-campo-2"
              type="number"
              step="0.1"
              className={inputClass}
              value={alturaCm}
              onChange={(e) => setAlturaCm(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-3 space-y-1">
          <label
            htmlFor="ficha-medica-campo-3"
            className="text-xs text-neutral-500"
          >
            Grupo sanguíneo
          </label>
          <input
            id="ficha-medica-campo-3"
            className={inputClass}
            maxLength={10}
            value={grupoSanguineo}
            onChange={(e) => setGrupoSanguineo(e.target.value)}
          />
        </div>
        <div className="mt-3 space-y-1">
          <label
            htmlFor="ficha-medica-campo-4"
            className="text-xs text-neutral-500"
          >
            Alergias
          </label>
          <textarea
            id="ficha-medica-campo-4"
            className={inputClass}
            rows={2}
            maxLength={500}
            value={alergias}
            onChange={(e) => setAlergias(e.target.value)}
          />
        </div>
        <div className="mt-3 space-y-1">
          <label
            htmlFor="ficha-medica-campo-5"
            className="text-xs text-neutral-500"
          >
            Antecedentes
          </label>
          <textarea
            id="ficha-medica-campo-5"
            className={inputClass}
            rows={2}
            maxLength={1000}
            value={antecedentes}
            onChange={(e) => setAntecedentes(e.target.value)}
          />
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <button
          onClick={guardarFicha}
          disabled={guardando}
          className="mt-3 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          {guardando ? "Guardando..." : "Guardar ficha médica"}
        </button>
      </div>

      <RevisionesClinicas tipo="ficha" id={pacienteId} version={version} />
      {puedeRegistrarVisita && (
        <div>
          <AvisoBorrador
            disponible={!!visita.disponible}
            obsoleto={visita.disponible?.versionBase !== version}
            estado={visita.estado}
            restaurar={() => {
              const data = visita.restaurar();
              if (data) {
                setMostrarVisita(true);
                setFechaVisita(data.fecha);
                setHoraVisita(data.horaInicio);
                setMotivoVisita(data.motivoConsulta);
                setNotasVisita(data.notasMedico);
              }
            }}
            descartar={visita.limpiar}
          />
          {!mostrarVisita ? (
            <button
              onClick={() => setMostrarVisita(true)}
              className="text-sm underline"
            >
              + Registrar otra visita con este paciente
            </button>
          ) : (
            <form
              onSubmit={registrarVisita}
              className="space-y-3 rounded-md border border-neutral-200 p-4 dark:border-neutral-800"
            >
              <h3 className="text-sm font-semibold">Nueva visita</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label
                    htmlFor="ficha-medica-campo-6"
                    className="text-xs text-neutral-500"
                  >
                    Fecha
                  </label>
                  <input
                    id="ficha-medica-campo-6"
                    type="date"
                    required
                    max={hoy}
                    className={inputClass}
                    value={fechaVisita}
                    onChange={(e) => setFechaVisita(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor="ficha-medica-campo-7"
                    className="text-xs text-neutral-500"
                  >
                    Hora
                  </label>
                  <input
                    id="ficha-medica-campo-7"
                    type="time"
                    className={inputClass}
                    value={horaVisita}
                    onChange={(e) => setHoraVisita(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label
                  htmlFor="ficha-medica-campo-8"
                  className="text-xs text-neutral-500"
                >
                  Motivo
                </label>
                <input
                  id="ficha-medica-campo-8"
                  className={inputClass}
                  maxLength={300}
                  value={motivoVisita}
                  onChange={(e) => setMotivoVisita(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label
                  htmlFor="ficha-medica-campo-9"
                  className="text-xs text-neutral-500"
                >
                  Notas clínicas
                </label>
                <textarea
                  id="ficha-medica-campo-9"
                  className={inputClass}
                  rows={8}
                  maxLength={MAX_NOTA_CLINICA}
                  value={notasVisita}
                  onChange={(e) => setNotasVisita(e.target.value)}
                />
                <p className="text-sm text-neutral-500">
                  {notasVisita.length.toLocaleString("es-AR")} /{" "}
                  {MAX_NOTA_CLINICA.toLocaleString("es-AR")} caracteres
                </p>
              </div>
              {errorVisita && (
                <p className="text-sm text-red-600">{errorVisita}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={guardandoVisita}
                  className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
                >
                  {guardandoVisita ? "Guardando..." : "Registrar visita"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirmarSalida()) setMostrarVisita(false);
                  }}
                  className="rounded-md border border-neutral-300 px-4 py-2 text-sm dark:border-neutral-700"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
