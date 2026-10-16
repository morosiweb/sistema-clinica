import { conErrores } from "@/lib/errores";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { permisosPorRol, serializarPermisos } from "@/lib/pantallas";
import { transaccionAgenda } from "@/lib/transaccion";
import { ErrorClinica } from "@/lib/errores";
import { usuarioSchema } from "@/lib/validations/usuario";

async function PATCHHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, response } = await requireAdmin();
  if (!session) return response;

  const { id } = await params;
  const body = await request.json();
  const parsed = usuarioSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Datos inválidos" },
      { status: 400 },
    );
  }
  const data = parsed.data;

  const otroConMismoEmail = await prisma.usuarioInterno.findFirst({
    where: { email: { equals: data.email, mode: "insensitive" }, NOT: { id } },
  });
  if (otroConMismoEmail) {
    return NextResponse.json(
      { error: "Ya existe otro usuario con ese email" },
      { status: 409 },
    );
  }

  if (data.rol !== "MEDICO" && data.medicoId) {
    return NextResponse.json(
      { error: "Solo un usuario MEDICO puede vincularse a un médico" },
      { status: 400 },
    );
  }
  if (data.medicoId) {
    const yaVinculado = await prisma.usuarioInterno.findFirst({
      where: { medicoId: data.medicoId, NOT: { id } },
    });
    if (yaVinculado) {
      return NextResponse.json(
        { error: "Ese médico ya tiene un usuario vinculado" },
        { status: 409 },
      );
    }
  }

  const passwordHash = data.password
    ? await bcrypt.hash(data.password, 10)
    : undefined;
  const usuario = await transaccionAgenda(async (tx) => {
    const actual = await tx.usuarioInterno.findUniqueOrThrow({ where: { id } });
    if (
      actual.rol === "ADMIN" &&
      actual.activo &&
      (data.rol !== "ADMIN" || !data.activo)
    ) {
      if (
        (await tx.usuarioInterno.count({
          where: { rol: "ADMIN", activo: true },
        })) <= 1
      )
        throw new ErrorClinica(
          "Debe quedar al menos un administrador activo",
          409,
        );
    }
    return tx.usuarioInterno.update({
      where: { id },
      data: {
        nombre: data.nombre,
        email: data.email,
        rol: data.rol,
        activo: data.activo,
        permisos:
          data.rol === "ADMIN"
            ? null
            : data.permisos
              ? serializarPermisos(data.permisos)
              : actual.rol !== data.rol
                ? serializarPermisos(permisosPorRol(data.rol))
                : actual.permisos,
        medicoId: data.rol === "MEDICO" ? data.medicoId || null : null,
        ...(data.password
          ? {
              password: passwordHash,
              intentosFallidos: 0,
              bloqueadoHasta: null,
            }
          : {}),
      },
      select: { id: true, nombre: true, email: true, rol: true, activo: true },
    });
  });

  return NextResponse.json(usuario);
}

export const PATCH = conErrores(PATCHHandler);
