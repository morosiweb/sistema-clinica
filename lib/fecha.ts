// Las fechas de agenda son días civiles; las horas pertenecen a la clínica.
export const ZONA_CLINICA =
  process.env.NEXT_PUBLIC_CLINIC_TIME_ZONE || "America/Argentina/Buenos_Aires";

export function fechaValida(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const fecha = new Date(`${valor}T00:00:00.000Z`);
  return (
    Number.isFinite(fecha.getTime()) &&
    fecha.toISOString().slice(0, 10) === valor
  );
}

export function fechaClinica(ahora = new Date()): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_CLINICA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(ahora);
  const parte = (tipo: string) => partes.find((p) => p.type === tipo)!.value;
  return `${parte("year")}-${parte("month")}-${parte("day")}`;
}

export function sumarDias(fecha: string, dias: number): string {
  const valor = new Date(`${fecha}T00:00:00.000Z`);
  valor.setUTCDate(valor.getUTCDate() + dias);
  return valor.toISOString().slice(0, 10);
}

export function fechaDB(fecha: string): Date {
  if (!fechaValida(fecha)) throw new Error("Fecha inválida");
  return new Date(`${fecha}T00:00:00.000Z`);
}

export function instanteClinica(fecha: string | Date, hora: string): Date {
  const dia =
    typeof fecha === "string" ? fecha : fecha.toISOString().slice(0, 10);
  if (!fechaValida(dia) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora))
    throw new Error("Fecha u hora inválida");
  const objetivo = Date.parse(`${dia}T${hora}:00Z`);
  let instante = objetivo;
  const formato = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_CLINICA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  for (let i = 0; i < 3; i++) {
    const partes = formato.formatToParts(new Date(instante));
    const p = (tipo: string) => partes.find((v) => v.type === tipo)!.value;
    const local = Date.parse(
      `${p("year")}-${p("month")}-${p("day")}T${p("hour")}:${p("minute")}:${p("second")}Z`,
    );
    const diferencia = objetivo - local;
    if (diferencia === 0) return new Date(instante);
    instante += diferencia;
  }
  throw new Error("Ese horario no existe en la zona de la clínica");
}

export function rangoInstantes(desde: string, hasta: string) {
  return {
    gte: instanteClinica(desde, "00:00"),
    lt: instanteClinica(sumarDias(hasta, 1), "00:00"),
  };
}
