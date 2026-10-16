-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "DiaSemana" AS ENUM ('LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO');

-- CreateEnum
CREATE TYPE "EstadoBloqueo" AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "EstadoTurno" AS ENUM ('PENDIENTE', 'CONFIRMADO', 'CANCELADO', 'AUSENTE', 'ATENDIDO');

-- CreateEnum
CREATE TYPE "CanalReserva" AS ENUM ('ONLINE', 'TELEFONO', 'PRESENCIAL');

-- CreateEnum
CREATE TYPE "AccionHistorialTurno" AS ENUM ('CREADO', 'MODIFICADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "MetodoPago" AS ENUM ('EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'OTRO');

-- CreateEnum
CREATE TYPE "RolInterno" AS ENUM ('ADMIN', 'SECRETARIA', 'MEDICO');

-- CreateTable
CREATE TABLE "Paciente" (
    "id" TEXT NOT NULL,
    "dni" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "telefono" TEXT,
    "email" TEXT,
    "fechaNacimiento" TIMESTAMP(3),
    "obraSocial" TEXT,
    "pesoKg" DOUBLE PRECISION,
    "alturaCm" DOUBLE PRECISION,
    "grupoSanguineo" TEXT,
    "alergias" TEXT,
    "antecedentes" TEXT,
    "tokenAccesoHash" TEXT NOT NULL,
    "tokenAccesoEnc" TEXT NOT NULL,
    "tokenGeneradoEl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ausenciasSinAviso" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Paciente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Especialidad" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Especialidad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Medico" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "matricula" TEXT,
    "especialidadId" TEXT NOT NULL,
    "telefono" TEXT,
    "email" TEXT,
    "duracionTurnoMinutos" INTEGER NOT NULL DEFAULT 30,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Medico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HorarioMedico" (
    "id" TEXT NOT NULL,
    "medicoId" TEXT NOT NULL,
    "diaSemana" "DiaSemana" NOT NULL,
    "horaInicio" TEXT NOT NULL,
    "horaFin" TEXT NOT NULL,
    "duracionTurno" INTEGER,
    "vigenteDesde" TIMESTAMP(3),
    "vigenteHasta" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HorarioMedico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BloqueoMedico" (
    "id" TEXT NOT NULL,
    "medicoId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "horaInicio" TEXT,
    "horaFin" TEXT,
    "motivo" TEXT,
    "estado" "EstadoBloqueo" NOT NULL DEFAULT 'PENDIENTE',
    "aprobadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BloqueoMedico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Turno" (
    "id" TEXT NOT NULL,
    "pacienteId" TEXT NOT NULL,
    "medicoId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "horaInicio" TEXT NOT NULL,
    "horaFin" TEXT NOT NULL,
    "estado" "EstadoTurno" NOT NULL DEFAULT 'PENDIENTE',
    "motivoConsulta" TEXT,
    "canalReserva" "CanalReserva" NOT NULL DEFAULT 'ONLINE',
    "notasSecretaria" TEXT,
    "notasMedico" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "recordatorioEnviado" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Turno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistorialTurno" (
    "id" TEXT NOT NULL,
    "turnoId" TEXT NOT NULL,
    "accion" "AccionHistorialTurno" NOT NULL,
    "realizadoPor" TEXT NOT NULL,
    "detalle" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistorialTurno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pago" (
    "id" TEXT NOT NULL,
    "turnoId" TEXT NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "metodo" "MetodoPago" NOT NULL DEFAULT 'EFECTIVO',
    "notas" TEXT,
    "registradoPor" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsuarioInterno" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "rol" "RolInterno" NOT NULL DEFAULT 'SECRETARIA',
    "medicoId" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "intentosFallidos" INTEGER NOT NULL DEFAULT 0,
    "bloqueadoHasta" TIMESTAMP(3),
    "permisos" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsuarioInterno_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Paciente_dni_key" ON "Paciente"("dni");

-- CreateIndex
CREATE UNIQUE INDEX "Paciente_tokenAccesoHash_key" ON "Paciente"("tokenAccesoHash");

-- CreateIndex
CREATE UNIQUE INDEX "Especialidad_nombre_key" ON "Especialidad"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Medico_matricula_key" ON "Medico"("matricula");

-- CreateIndex
CREATE INDEX "Medico_especialidadId_idx" ON "Medico"("especialidadId");

-- CreateIndex
CREATE INDEX "HorarioMedico_medicoId_idx" ON "HorarioMedico"("medicoId");

-- CreateIndex
CREATE INDEX "BloqueoMedico_medicoId_idx" ON "BloqueoMedico"("medicoId");

-- CreateIndex
CREATE INDEX "BloqueoMedico_fecha_idx" ON "BloqueoMedico"("fecha");

-- CreateIndex
CREATE INDEX "Turno_medicoId_fecha_idx" ON "Turno"("medicoId", "fecha");

-- CreateIndex
CREATE INDEX "Turno_pacienteId_idx" ON "Turno"("pacienteId");

-- CreateIndex
CREATE INDEX "HistorialTurno_turnoId_idx" ON "HistorialTurno"("turnoId");

-- CreateIndex
CREATE INDEX "Pago_turnoId_idx" ON "Pago"("turnoId");

-- CreateIndex
CREATE INDEX "Pago_fecha_idx" ON "Pago"("fecha");

-- CreateIndex
CREATE UNIQUE INDEX "UsuarioInterno_email_key" ON "UsuarioInterno"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UsuarioInterno_medicoId_key" ON "UsuarioInterno"("medicoId");

-- AddForeignKey
ALTER TABLE "Medico" ADD CONSTRAINT "Medico_especialidadId_fkey" FOREIGN KEY ("especialidadId") REFERENCES "Especialidad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HorarioMedico" ADD CONSTRAINT "HorarioMedico_medicoId_fkey" FOREIGN KEY ("medicoId") REFERENCES "Medico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BloqueoMedico" ADD CONSTRAINT "BloqueoMedico_medicoId_fkey" FOREIGN KEY ("medicoId") REFERENCES "Medico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BloqueoMedico" ADD CONSTRAINT "BloqueoMedico_aprobadoPorId_fkey" FOREIGN KEY ("aprobadoPorId") REFERENCES "UsuarioInterno"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Turno" ADD CONSTRAINT "Turno_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "Paciente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Turno" ADD CONSTRAINT "Turno_medicoId_fkey" FOREIGN KEY ("medicoId") REFERENCES "Medico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistorialTurno" ADD CONSTRAINT "HistorialTurno_turnoId_fkey" FOREIGN KEY ("turnoId") REFERENCES "Turno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_turnoId_fkey" FOREIGN KEY ("turnoId") REFERENCES "Turno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsuarioInterno" ADD CONSTRAINT "UsuarioInterno_medicoId_fkey" FOREIGN KEY ("medicoId") REFERENCES "Medico"("id") ON DELETE SET NULL ON UPDATE CASCADE;
