"use client";
import { useState, useRef, type ReactNode } from "react";
import { fetchJSON, mensajeError, useRecurso } from "@/lib/cliente";
import { Download, Upload, FileText } from "lucide-react";

type Registro = { id: string; createdAt: string; autor: { nombre: string } };
type Nota = Registro & { contenido: string };
type Archivo = Registro & { nombre: string; tamanio: number };
export function DocumentacionPaciente({
  pacienteId,
  children,
}: {
  pacienteId: string;
  children: ReactNode;
}) {
  const [contenido, setContenido] = useState("");
  const [paginaNotas, setPaginaNotas] = useState(1);
  const [paginaArchivos, setPaginaArchivos] = useState(1);
  const base = `/api/pacientes/${pacienteId}`;
  const notas = useRecurso<Nota[]>(`${base}/notas?pagina=${paginaNotas}`);
  const archivos = useRecurso<Archivo[]>(
    `${base}/archivos?pagina=${paginaArchivos}`,
  );
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const archivoInput = useRef<HTMLInputElement>(null);
  async function guardarNota(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setAviso("");
    setOcupado(true);
    try {
      await fetchJSON(`${base}/notas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contenido }),
      });
      setContenido("");
      setPaginaNotas(1);
      notas.refrescar();
      setAviso("Nota guardada.");
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setOcupado(false);
    }
  }
  async function subir(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setAviso("");
    const archivo = archivoInput.current?.files?.[0];
    if (!archivo) {
      setError("Seleccioná un archivo");
      return;
    }
    if (archivo.size > 3 * 1024 * 1024) {
      setError("El archivo supera el máximo de 3 MB");
      return;
    }
    setOcupado(true);
    try {
      const datos = new FormData();
      datos.append("archivo", archivo);
      await fetchJSON(`${base}/archivos`, { method: "POST", body: datos });
      if (archivoInput.current) archivoInput.current.value = "";
      setPaginaArchivos(1);
      archivos.refrescar();
      setAviso("Archivo guardado en la ficha del paciente.");
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setOcupado(false);
    }
  }
  const fecha = (v: string) => new Date(v).toLocaleString("es-AR");
  return (
    <section className="patient-documents mt-10 space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Notas y archivos compartidos</h2>
      </div>
      {(error || notas.error || archivos.error) && (
        <p role="alert" className="notice notice-error">
          {error || notas.error || archivos.error}
        </p>
      )}
      {aviso && (
        <p role="status" className="notice">
          {aviso}
        </p>
      )}
      <div className="patient-record-columns">
        {children}
        <section
          className="surface p-5 space-y-4"
          aria-labelledby="notas-paciente-titulo"
        >
          <h3 id="notas-paciente-titulo" className="text-lg font-semibold">
            Notas del paciente
          </h3>
          <form onSubmit={guardarNota} className="space-y-3">
            <label className="block">
              Nueva nota
              <textarea
                required
                maxLength={10000}
                value={contenido}
                onChange={(e) => setContenido(e.target.value)}
                rows={4}
                className="shared-input"
              />
            </label>
            <button className="btn btn-primary" disabled={ocupado}>
              Guardar nota
            </button>
          </form>
          {notas.cargando && <p role="status">Cargando notas…</p>}
          {notas.data?.map((n) => (
            <article key={n.id} className="patient-note">
              <p className="whitespace-pre-wrap break-words">{n.contenido}</p>
              <p className="text-sm text-neutral-500">
                {n.autor.nombre} · {fecha(n.createdAt)}
              </p>
            </article>
          ))}
          {notas.data?.length === 0 && <p>No hay notas compartidas todavía.</p>}
          <div className="flex gap-3">
            <button
              disabled={paginaNotas === 1 || notas.cargando}
              onClick={() => setPaginaNotas((p) => p - 1)}
            >
              Notas más recientes
            </button>
            <button
              disabled={notas.data?.length !== 25 || notas.cargando}
              onClick={() => setPaginaNotas((p) => p + 1)}
            >
              Notas anteriores
            </button>
          </div>
        </section>
      </div>
      <section
        className="surface p-5 space-y-4"
        aria-labelledby="archivos-paciente-titulo"
      >
        <h3 id="archivos-paciente-titulo" className="text-lg font-semibold">
          <FileText className="inline mr-2" size={20} />
          Archivos del paciente
        </h3>
        <form onSubmit={subir} className="space-y-3">
          <label className="block">
            Agregar archivo
            <input
              type="file"
              ref={archivoInput}
              required
              accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx,.txt"
              className="shared-input"
            />
          </label>
          <p className="text-sm">
            PDF, imágenes, Word, Excel o texto. Hasta 3 MB por archivo.
          </p>
          <button className="btn btn-primary" disabled={ocupado}>
            <Upload size={18} />
            Guardar archivo
          </button>
        </form>
        {archivos.cargando && <p role="status">Cargando archivos…</p>}
        {archivos.data?.map((a) => (
          <article key={a.id} className="patient-file">
            <div>
              <strong className="break-all">{a.nombre}</strong>
              <p className="text-sm">
                {a.autor.nombre} · {fecha(a.createdAt)} ·{" "}
                {Math.max(1, Math.ceil(a.tamanio / 1024))} KB
              </p>
            </div>
            <a
              className="btn btn-outline"
              href={`${base}/archivos/${a.id}`}
              download
            >
              <Download size={18} />
              Descargar
            </a>
          </article>
        ))}
        {archivos.data?.length === 0 && (
          <p>No hay archivos guardados todavía.</p>
        )}
        <div className="flex gap-3">
          <button
            disabled={paginaArchivos === 1 || archivos.cargando}
            onClick={() => setPaginaArchivos((p) => p - 1)}
          >
            Archivos más recientes
          </button>
          <button
            disabled={archivos.data?.length !== 25 || archivos.cargando}
            onClick={() => setPaginaArchivos((p) => p + 1)}
          >
            Archivos anteriores
          </button>
        </div>
      </section>
    </section>
  );
}
