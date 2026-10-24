import { conErrores } from "@/lib/errores";
import { after, NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { turnoParaInterno } from "@/lib/turno-dto";
import { fechaSchema } from "@/lib/validations/comun";
import { crearTurnoSchema } from "@/lib/validations/turno";
import { crearTurnoEnTx, HorarioOcupadoError } from "@/lib/turnos";
import { crearTokenAcceso } from "@/lib/pacientes";
import { transaccionAgenda } from "@/lib/transaccion";
import { procesarAvisosTurno } from "@/lib/avisos-turno";
import { ErrorClinica } from "@/lib/errores";

export const maxDuration = 60;

async function GETHandler(request: NextRequest) {
  const { session, response } = await requireSession(["turnos", "agenda"]);
  if (!session) return response;

  const fecha = request.nextUrl.searchParams.get("fecha");
  if (fecha) fechaSchema.parse(fecha);
  const medicoId = request.nextUrl.searchParams.get("medicoId");

  // Un MEDICO solo puede ver su propia agenda, salvo que tenga permiso de "turnos".
  const esSoloAgenda = session.user.rol === "MEDICO";

  const turnos = await prisma.turno.findMany({
    where: {
      ...(fecha ? { fecha: new Date(`${fecha}T00:00:00.000Z`) } : {}),
      ...(medicoId ? { medicoId } : {}),
      ...(esSoloAgenda
        ? { medicoId: session.user.medicoId ?? "__ninguno__" }
        : {}),
    },
    include: {
      paciente: {
        select: {
          id: true,
          nombre: true,
          apellido: true,
          dni: true,
          telefono: true,
        },
      },
      medico: { include: { especialidad: true } },
    },
    orderBy: [{ fecha: "asc" }, { horaInicio: "asc" }],
    take: 200,
  });

  return NextResponse.json(
    turnos.map((t) => turnoParaInterno(t, session.user)),
  );
}

async function POSTHandler(request: NextRequest) {
  const { session, response } = await requireSession(["turnos"]);
  if (!session) return response;

  const body = await request.json();
  const parsed = crearTurnoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Datos inválidos" },
      { status: 400 },
    );
  }
  const data = parsed.data;

  try {
    const turno = await transaccionAgenda(async (tx) => {
      let pacienteId = data.pacienteId;
      if (data.pacienteNuevo) {
        const p = data.pacienteNuevo;
        if (
          await tx.paciente.findUnique({
            where: { dni: p.dni },
            select: { id: true },
          })
        )
          throw new ErrorClinica(
            "Ya existe un paciente con ese DNI. Buscalo como paciente existente.",
            409,
          );
        const { tokenAccesoHash, tokenAccesoEnc } = crearTokenAcceso();
        const paciente = await tx.paciente.create({
          data: {
            ...p,
            telefono: p.telefono || null,
            email: p.email || null,
            fechaNacimiento: p.fechaNacimiento
              ? new Date(`${p.fechaNacimiento}T00:00:00Z`)
              : null,
            obraSocial: p.obraSocial || null,
            tokenAccesoHash,
            tokenAccesoEnc,
          },
          select: { id: true },
        });
        pacienteId = paciente.id;
      }
      return crearTurnoEnTx(tx, {
        pacienteId: pacienteId!,
        medicoId: data.medicoId,
        fecha: data.fecha,
        horaInicio: data.horaInicio,
        motivoConsulta: data.motivoConsulta,
        canalReserva: "PRESENCIAL",
        realizadoPor: session.user.email ?? session.user.id,
      });
    });
    after(async () => {
      await procesarAvisosTurno();
    });
    return NextResponse.json(turno, { status: 201 });
  } catch (e) {
    if (e instanceof HorarioOcupadoError) {
      return NextResponse.json(
        { error: "Ese horario ya fue tomado, elegí otro." },
        { status: 409 },
      );
    }
    throw e;
  }
}

export const GET = conErrores(GETHandler);
export const POST = conErrores(POSTHandler);
