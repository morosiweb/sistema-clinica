import { conErrores } from "@/lib/errores";
import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { horarioSchema } from "@/lib/validations/medico";
import { transaccionAgenda } from "@/lib/transaccion";
import { fechaDB } from "@/lib/fecha";
import { solapa } from "@/lib/disponibilidad";
import { ErrorClinica } from "@/lib/errores";
async function POSTHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, response } = await requireSession(["medicos"]);
  if (!session) return response;
  const data = horarioSchema.parse(await request.json());
  const medicoId = (await params).id;
  if (
    data.horaInicio >= data.horaFin ||
    (data.vigenteDesde &&
      data.vigenteHasta &&
      data.vigenteDesde > data.vigenteHasta)
  )
    throw new ErrorClinica(
      "Revisá el orden de los horarios y las fechas de vigencia",
    );
  const desde = data.vigenteDesde ? fechaDB(data.vigenteDesde) : null,
    hasta = data.vigenteHasta ? fechaDB(data.vigenteHasta) : null;
  const horario = await transaccionAgenda(async (tx) => {
    const existentes = await tx.horarioMedico.findMany({
      where: { medicoId, diaSemana: data.diaSemana },
    });
    if (
      existentes.some(
        (h) =>
          solapa(data.horaInicio, data.horaFin, h.horaInicio, h.horaFin) &&
          (!desde || !h.vigenteHasta || desde <= h.vigenteHasta) &&
          (!hasta || !h.vigenteDesde || hasta >= h.vigenteDesde),
      )
    )
      throw new ErrorClinica(
        "Ese bloque se superpone con otro horario vigente",
        409,
      );
    return tx.horarioMedico.create({
      data: {
        medicoId,
        diaSemana: data.diaSemana,
        horaInicio: data.horaInicio,
        horaFin: data.horaFin,
        duracionTurno: data.duracionTurno || null,
        vigenteDesde: desde,
        vigenteHasta: hasta,
      },
    });
  });
  return NextResponse.json(horario, { status: 201 });
}

export const POST = conErrores(POSTHandler);
