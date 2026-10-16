import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { unstable_rethrow } from "next/navigation";
import { ErrorCifradoToken } from "@/lib/token";

export class ErrorClinica extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export function respuestaError(error: unknown) {
  if (error instanceof ErrorClinica)
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  if (error instanceof ZodError)
    return NextResponse.json(
      { error: error.issues[0]?.message || "Datos inválidos" },
      { status: 400 },
    );
  if (error instanceof SyntaxError)
    return NextResponse.json(
      { error: "El cuerpo debe ser JSON válido" },
      { status: 400 },
    );
  const codigo =
    error && typeof error === "object" && "code" in error ? error.code : null;
  if (codigo === "P2002")
    return NextResponse.json(
      { error: "Ya existe un registro con esos datos" },
      { status: 409 },
    );
  if (codigo === "P2025")
    return NextResponse.json(
      { error: "Registro no encontrado" },
      { status: 404 },
    );
  if (codigo === "P2003")
    return NextResponse.json(
      { error: "La referencia indicada no existe o está en uso" },
      { status: 400 },
    );
  // Una sola línea: Vercel puede ocultar argumentos adicionales. No registrar
  // message, stack ni meta: Prisma puede incluir datos de pacientes o consultas.
  const codigoSeguro =
    error instanceof ErrorCifradoToken
      ? error.code
      : typeof codigo === "string" && /^P\d{4}$/.test(codigo)
        ? codigo
        : "OPERACION_FALLIDA";
  console.error(`Error de operación codigo=${codigoSeguro}`);
  return NextResponse.json(
    { error: "No se pudo completar la operación. Intentá nuevamente." },
    { status: 500 },
  );
}

export function conErrores<Args extends unknown[], R>(
  handler: (...args: Args) => Promise<R>,
) {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (error) {
      unstable_rethrow(error);
      return respuestaError(error);
    }
  };
}
