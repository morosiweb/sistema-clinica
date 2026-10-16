import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer as createNetServer } from "node:net";
import { createServer } from "node:http";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import EmbeddedPostgres from "embedded-postgres";
import { request, chromium, type APIRequestContext } from "@playwright/test";
import bcrypt from "bcryptjs";

async function main() {
  async function puertoLibre() {
    const s = createNetServer();
    await new Promise<void>((r) => s.listen(0, "127.0.0.1", r));
    const a = s.address();
    assert(a && typeof a !== "string");
    const port = a.port;
    await new Promise<void>((r) => s.close(() => r()));
    return port;
  }
  const temporal = await mkdtemp(path.join(tmpdir(), "clinica-test-"));
  const temporalAbsoluto = path.resolve(temporal);
  assert(
    temporalAbsoluto.startsWith(path.resolve(tmpdir()) + path.sep) &&
      path.basename(temporalAbsoluto).startsWith("clinica-test-"),
  );
  const pgPort = await puertoLibre(),
    appPort = await puertoLibre(),
    mailPort = await puertoLibre();
  let fallarCorreo = false;
  const correos: {
    to: string[];
    subject: string;
    text: string;
    html: string;
  }[] = [];
  const mail = createServer(async (req, res) => {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    res.setHeader("Content-Type", "application/json");
    if (fallarCorreo) {
      res.statusCode = 503;
      res.end(
        JSON.stringify({
          name: "application_error",
          message: "Fallo simulado",
        }),
      );
      return;
    }
    const mensaje = JSON.parse(raw);
    correos.push({
      ...mensaje,
      to: Array.isArray(mensaje.to) ? mensaje.to : [mensaje.to],
    });
    res.end(JSON.stringify({ id: randomBytes(8).toString("hex") }));
  });
  const pg = new EmbeddedPostgres({
    databaseDir: path.join(temporal, "db"),
    port: pgPort,
    user: "postgres",
    password: "test-only-password",
    persistent: true,
    createPostgresUser: false,
    initdbFlags: ["--encoding=UTF8"],
    postgresFlags: ["-h", "127.0.0.1", "-F"],
    onLog: () => {},
    onError: () => {},
  });
  let app: ChildProcess | undefined;
  let appLogs = "";
  let cerrarPrisma: (() => Promise<void>) | undefined;
  let casos = 0;
  const contexts: APIRequestContext[] = [];
  async function caso(nombre: string, fn: () => Promise<void>) {
    await fn();
    casos++;
    console.log(`OK ${casos}: ${nombre}`);
  }
  function codigoPara(email: string) {
    const correo = [...correos]
      .reverse()
      .find((c) => c.to.includes(email) && c.subject.includes("código"));
    assert(correo, "El código debe llegar al correo esperado");
    const match = correo.text.match(/\b(\d{6})\b/);
    assert(match);
    return match[1];
  }
  async function finalizarProceso(child: ChildProcess) {
    if (child.exitCode !== null) return;
    const fin = new Promise<void>((r) => child.once("exit", () => r()));
    child.kill();
    await fin;
  }
  try {
    await pg.initialise();
    await pg.start();
    await pg.createDatabase("clinica_test");
    process.env.DATABASE_URL = `postgresql://postgres:test-only-password@127.0.0.1:${pgPort}/clinica_test`;
    process.env.DIRECT_URL = process.env.DATABASE_URL;
    process.env.NEXTAUTH_URL = `http://127.0.0.1:${appPort}`;
    process.env.NEXTAUTH_SECRET = randomBytes(32).toString("hex");
    process.env.AUTH_SECRET = process.env.NEXTAUTH_SECRET;
    process.env.AUTH_TRUST_HOST = "true";
    process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    process.env.CRON_SECRET = "cron-test-only";
    process.env.RESEND_API_KEY = "re_test_only";
    process.env.EMAIL_PROVIDER = "resend";
    delete process.env.GMAIL_USER;
    delete process.env.GMAIL_APP_PASSWORD;
    process.env.RESEND_BASE_URL = `http://127.0.0.1:${mailPort}`;
    process.env.EMAIL_FROM = "Clinica <test@example.test>";
    process.env.NEXT_PUBLIC_CLINIC_TIME_ZONE = "America/Argentina/Buenos_Aires";
    await new Promise<void>((r) => mail.listen(mailPort, "127.0.0.1", r));
    const administradorLocal = pg.getPgClient("postgres", "127.0.0.1");
    await administradorLocal.connect();
    await administradorLocal.query(
      "CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;",
    );
    await administradorLocal.end();
    const migracion = spawnSync(
      process.execPath,
      ["node_modules/prisma/build/index.js", "migrate", "deploy"],
      { env: process.env, encoding: "utf8", windowsHide: true },
    );
    assert.equal(migracion.status, 0, migracion.stdout + migracion.stderr);
    await caso(
      "las migraciones conservan y normalizan datos anteriores",
      async () => {
        await pg.createDatabase("legado");
        const client = pg.getPgClient("legado", "127.0.0.1");
        await client.connect();
        try {
          await client.query(
            await readFile(
              "prisma/migrations/202610160001_baseline/migration.sql",
              "utf8",
            ),
          );
          await client.query(
            `INSERT INTO "Paciente" (id,dni,nombre,apellido,email,"tokenAccesoHash","tokenAccesoEnc","updatedAt",alergias) VALUES ('previo','12.345.678','Paciente','Previo','PREVIO@EXAMPLE.TEST','hash-previo','enc-previo',NOW(),'Alergia previa')`,
          );
          await client.query(
            await readFile(
              "prisma/migrations/202610160002_seguridad_clinica/migration.sql",
              "utf8",
            ),
          );
          const result = await client.query(
            `SELECT dni,email,"tokenAccesoEnc",alergias FROM "Paciente" WHERE id='previo'`,
          );
          assert.deepEqual(result.rows[0], {
            dni: "12345678",
            email: "previo@example.test",
            tokenAccesoEnc: "enc-previo",
            alergias: "Alergia previa",
          });
          assert.equal(
            (
              await client.query(
                `SELECT count(*)::int AS cantidad FROM "RevisionFicha"`,
              )
            ).rows[0].cantidad,
            1,
          );
        } finally {
          await client.end();
        }
      },
    );
    const { prisma } = await import("../lib/prisma");
    cerrarPrisma = () => prisma.$disconnect();
    await caso(
      "las tablas clínicas no permiten acceso a roles públicos",
      async () => {
        const seguridad = await prisma.$queryRaw<
          { protegida: boolean; publico: boolean }[]
        >`SELECT c.relrowsecurity AS protegida, has_table_privilege('anon', '"Paciente"', 'SELECT') AS publico FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname='public' AND c.relname='Paciente'`;
        assert.equal(seguridad[0].protegida, true);
        assert.equal(seguridad[0].publico, false);
      },
    );
    const { crearTokenAcceso } = await import("../lib/pacientes");
    const { fechaClinica, sumarDias, fechaDB } = await import("../lib/fecha");
    const { crearTurno, actualizarTurno, reprogramarTurno } =
      await import("../lib/turnos");
    const futuro = sumarDias(fechaClinica(), 3),
      ayer = sumarDias(fechaClinica(), -1);
    const especialidad = await prisma.especialidad.create({
      data: { nombre: "Prueba" },
    });
    const medico = await prisma.medico.create({
      data: {
        nombre: "Medico",
        apellido: "Prueba",
        especialidadId: especialidad.id,
        duracionTurnoMinutos: 15,
      },
    });
    const otroMedico = await prisma.medico.create({
      data: {
        nombre: "Otro",
        apellido: "Medico",
        especialidadId: especialidad.id,
        duracionTurnoMinutos: 15,
      },
    });
    const dias = [
      "DOMINGO",
      "LUNES",
      "MARTES",
      "MIERCOLES",
      "JUEVES",
      "VIERNES",
      "SABADO",
    ] as const;
    await prisma.horarioMedico.create({
      data: {
        medicoId: medico.id,
        diaSemana: dias[fechaDB(futuro).getUTCDay()],
        horaInicio: "07:00",
        horaFin: "22:00",
      },
    });
    const acceso = crearTokenAcceso();
    const paciente = await prisma.paciente.create({
      data: {
        dni: "12345678",
        nombre: "Titular",
        apellido: "Prueba",
        email: "titular@example.test",
        tokenAccesoHash: acceso.tokenAccesoHash,
        tokenAccesoEnc: acceso.tokenAccesoEnc,
      },
    });
    const otroAcceso = crearTokenAcceso();
    const otroPaciente = await prisma.paciente.create({
      data: {
        dni: "23456789",
        nombre: "Otro",
        apellido: "Paciente",
        email: "otro@example.test",
        tokenAccesoHash: otroAcceso.tokenAccesoHash,
        tokenAccesoEnc: otroAcceso.tokenAccesoEnc,
      },
    });
    const nota = await prisma.turno.create({
      data: {
        pacienteId: paciente.id,
        medicoId: medico.id,
        fecha: fechaDB(ayer),
        horaInicio: "09:00",
        horaFin: "09:15",
        estado: "ATENDIDO",
        notasMedico: "CLINICA_SECRETA",
        notasSecretaria: "INTERNA_SECRETA",
      },
    });
    const password = await bcrypt.hash("Prueba12345", 10);
    const admin = await prisma.usuarioInterno.create({
      data: {
        nombre: "Admin Prueba",
        email: "admin@example.test",
        password,
        rol: "ADMIN",
      },
    });
    const secretaria = await prisma.usuarioInterno.create({
      data: {
        nombre: "Secretaria Prueba",
        email: "secretaria@example.test",
        password,
        rol: "SECRETARIA",
        permisos: JSON.stringify([
          "pacientes",
          "turnos",
          "medicos",
          "especialidades",
          "bloqueos",
          "reportes",
        ]),
      },
    });
    const doctor = await prisma.usuarioInterno.create({
      data: {
        nombre: "Doctor Prueba",
        email: "doctor@example.test",
        password,
        rol: "MEDICO",
        medicoId: medico.id,
        permisos: JSON.stringify(["agenda", "bloqueos"]),
      },
    });
    const baseURL = process.env.NEXTAUTH_URL;
    app = spawn(
      process.execPath,
      [
        "node_modules/next/dist/bin/next",
        "start",
        "-p",
        String(appPort),
        "-H",
        "127.0.0.1",
      ],
      {
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      },
    );
    app.stdout?.on("data", (b) => {
      appLogs = (appLogs + b.toString()).slice(-8000);
    });
    app.stderr?.on("data", (b) => {
      appLogs = (appLogs + b.toString()).slice(-8000);
    });
    const limite = Date.now() + 45000;
    while (true) {
      try {
        const r = await fetch(baseURL);
        if (r.status === 200) break;
      } catch {}
      if (Date.now() > limite) throw Error("El servidor no inició: " + appLogs);
      await new Promise((r) => setTimeout(r, 250));
    }
    async function cliente(email?: string) {
      const api = await request.newContext({ baseURL });
      contexts.push(api);
      if (email) {
        const csrf = await (await api.get("/api/auth/csrf")).json();
        const login = await api.post("/api/auth/callback/credentials", {
          form: {
            csrfToken: csrf.csrfToken,
            email,
            password: "Prueba12345",
            callbackUrl: baseURL + "/panel",
          },
          maxRedirects: 0,
        });
        assert([200, 302, 303].includes(login.status()));
        const session = await (await api.get("/api/auth/session")).json();
        assert(session.user, `No inició sesión ${email}`);
      }
      return api;
    }
    const anon = await cliente(),
      sec = await cliente(secretaria.email),
      adm = await cliente(admin.email),
      doc = await cliente(doctor.email);
    const datos = {
      dni: paciente.dni,
      nombre: "Identidad Falsa",
      apellido: "Prueba",
      telefono: "12345678",
      email: "intruso@example.test",
      medicoId: medico.id,
      fecha: futuro,
      horaInicio: "09:15",
    };
    await caso(
      "el diagnóstico del correo requiere administrador y no expone secretos",
      async () => {
        assert.equal((await anon.get("/api/admin/correo")).status(), 401);
        assert.equal((await sec.get("/api/admin/correo")).status(), 403);
        assert.equal((await doc.get("/api/admin/correo")).status(), 403);
        const response = await adm.get("/api/admin/correo");
        assert.equal(response.status(), 200);
        const data = await response.json();
        assert.equal(data.proveedor, "resend");
        assert.equal(data.ok, false);
        assert(!JSON.stringify(data).includes(process.env.RESEND_API_KEY!));
        assert.equal(response.headers()["cache-control"], "private, no-store");
      },
    );
    await caso(
      "reservar con DNI y sin código no entrega un token ni crea un turno",
      async () => {
        const r = await anon.post("/api/publico/reservar", { data: datos });
        assert.equal(r.status(), 400);
        assert(!JSON.stringify(await r.json()).includes(acceso.token));
      },
    );
    let challenge = "",
      codigo = "",
      reservado = "";
    await caso(
      "el código para un DNI existente solo llega al contacto registrado",
      async () => {
        const r = await anon.post("/api/publico/verificacion", {
          data: { dni: datos.dni, email: datos.email },
        });
        assert.equal(r.status(), 200);
        challenge = (await r.json()).verificacionId;
        codigo = codigoPara(paciente.email!);
        assert.equal(
          correos.filter((c) => c.to.includes(datos.email)).length,
          0,
        );
      },
    );
    await caso(
      "un código incorrecto consume un intento sin permitir acceso",
      async () => {
        const r = await anon.post("/api/publico/reservar", {
          data: {
            ...datos,
            verificacionId: challenge,
            codigo: codigo === "000000" ? "111111" : "000000",
          },
        });
        assert.equal(r.status(), 400);
        assert.equal(
          (
            await prisma.verificacionPaciente.findUniqueOrThrow({
              where: { id: challenge },
            })
          ).intentos,
          1,
        );
      },
    );
    await caso(
      "la reserva verificada reutiliza la identidad sin cambiar contacto ni nombre",
      async () => {
        const r = await anon.post("/api/publico/reservar", {
          data: { ...datos, verificacionId: challenge, codigo },
        });
        assert.equal(r.status(), 201, await r.text());
        const data = await r.json();
        assert.equal(data.linkAcceso, `/mi-turno/${acceso.token}`);
        reservado = data.turno.id;
        const p = await prisma.paciente.findUniqueOrThrow({
          where: { id: paciente.id },
        });
        assert.equal(p.email, paciente.email);
        assert.equal(p.nombre, paciente.nombre);
      },
    );
    await caso("un código ya utilizado no se puede reproducir", async () => {
      const r = await anon.post("/api/publico/reservar", {
        data: {
          ...datos,
          horaInicio: "09:30",
          verificacionId: challenge,
          codigo,
        },
      });
      assert.equal(r.status(), 400);
    });
    await caso(
      "un paciente nuevo verifica su email antes del alta y reserva",
      async () => {
        const nuevos = {
          ...datos,
          dni: "87654321",
          nombre: "Paciente Nuevo",
          email: "nuevo@example.test",
          horaInicio: "09:45",
        };
        const c = await (
          await anon.post("/api/publico/verificacion", {
            data: { dni: nuevos.dni, email: nuevos.email },
          })
        ).json();
        assert.equal(
          await prisma.paciente.count({ where: { dni: nuevos.dni } }),
          0,
        );
        const r = await anon.post("/api/publico/reservar", {
          data: {
            ...nuevos,
            verificacionId: c.verificacionId,
            codigo: codigoPara(nuevos.email),
          },
        });
        assert.equal(r.status(), 201);
        assert.equal(
          await prisma.paciente.count({ where: { dni: nuevos.dni } }),
          1,
        );
      },
    );
    await caso("cinco intentos fallidos invalidan el código", async () => {
      const c = await (
        await anon.post("/api/publico/verificacion", {
          data: { dni: "33445566", email: "intentos@example.test" },
        })
      ).json();
      const correcto = codigoPara("intentos@example.test");
      const malo = correcto === "000000" ? "111111" : "000000";
      for (let i = 0; i < 5; i++)
        assert.equal(
          (
            await anon.post("/api/publico/reservar", {
              data: {
                ...datos,
                dni: "33445566",
                email: "intentos@example.test",
                verificacionId: c.verificacionId,
                codigo: malo,
              },
            })
          ).status(),
          400,
        );
      assert.equal(
        (
          await anon.post("/api/publico/reservar", {
            data: {
              ...datos,
              dni: "33445566",
              email: "intentos@example.test",
              verificacionId: c.verificacionId,
              codigo: correcto,
            },
          })
        ).status(),
        400,
      );
    });
    await caso("un código vencido no permite reservar", async () => {
      const email = "vencido@example.test";
      const c = await (
        await anon.post("/api/publico/verificacion", {
          data: { dni: "99887766", email },
        })
      ).json();
      await prisma.verificacionPaciente.update({
        where: { id: c.verificacionId },
        data: { venceEl: new Date(Date.now() - 1000) },
      });
      const r = await anon.post("/api/publico/reservar", {
        data: {
          ...datos,
          dni: "99887766",
          email,
          verificacionId: c.verificacionId,
          codigo: codigoPara(email),
        },
      });
      assert.equal(r.status(), 400);
    });
    await caso("la recuperación usa código de un solo uso", async () => {
      const c = await (
        await anon.post("/api/publico/recuperar", {
          data: { dni: paciente.dni },
        })
      ).json();
      const body = {
        verificacionId: c.verificacionId,
        codigo: codigoPara(paciente.email!),
      };
      const r = await anon.post("/api/publico/verificar", { data: body });
      assert.equal(r.status(), 200);
      assert.equal((await r.json()).linkAcceso, `/mi-turno/${acceso.token}`);
      assert.equal(
        (await anon.post("/api/publico/verificar", { data: body })).status(),
        400,
      );
    });
    await caso(
      "el paciente y secretaría no reciben notas clínicas por API",
      async () => {
        const publico = await (
          await anon.get(`/api/publico/mi-turno/${acceso.token}`)
        ).json();
        assert(!JSON.stringify(publico).includes("CLINICA_SECRETA"));
        assert(!JSON.stringify(publico).includes("INTERNA_SECRETA"));
        const lista = await (await sec.get(`/api/turnos?fecha=${ayer}`)).json();
        assert.equal(lista[0].notasMedico, null);
        const r = await sec.patch(`/api/turnos/${nota.id}`, {
          data: {
            estado: "ATENDIDO",
            version: 0,
            notasSecretaria: "Actualizada",
          },
        });
        assert.equal(r.status(), 200);
        assert.equal((await r.json()).notasMedico, null);
      },
    );
    await caso("dos reservas simultáneas solo confirman una", async () => {
      const p = {
        pacienteId: paciente.id,
        medicoId: medico.id,
        fecha: futuro,
        horaInicio: "11:00",
        canalReserva: "PRESENCIAL" as const,
        realizadoPor: admin.id,
      };
      const resultados = await Promise.allSettled([
        crearTurno(p),
        crearTurno({ ...p, pacienteId: otroPaciente.id }),
      ]);
      assert.equal(
        resultados.filter((r) => r.status === "fulfilled").length,
        1,
      );
      assert.equal(
        await prisma.turno.count({
          where: {
            medicoId: medico.id,
            fecha: fechaDB(futuro),
            horaInicio: "11:00",
            estado: { not: "CANCELADO" },
          },
        }),
        1,
      );
    });
    await caso(
      "no se reserva fuera de horario, en el pasado o con médico inactivo",
      async () => {
        const p = {
          pacienteId: paciente.id,
          medicoId: medico.id,
          fecha: futuro,
          horaInicio: "03:00",
          canalReserva: "PRESENCIAL" as const,
          realizadoPor: admin.id,
        };
        await assert.rejects(crearTurno(p));
        await assert.rejects(
          crearTurno({ ...p, fecha: ayer, horaInicio: "10:00" }),
        );
        await prisma.medico.update({
          where: { id: otroMedico.id },
          data: { activo: false },
        });
        await assert.rejects(
          crearTurno({ ...p, medicoId: otroMedico.id, horaInicio: "10:00" }),
        );
      },
    );
    await caso(
      "reactivar un cancelado no puede ocupar el horario de su reemplazo",
      async () => {
        const p = {
          pacienteId: paciente.id,
          medicoId: medico.id,
          fecha: futuro,
          horaInicio: "12:00",
          canalReserva: "PRESENCIAL" as const,
          realizadoPor: admin.id,
        };
        const a = await crearTurno(p);
        await actualizarTurno(
          a.id,
          { estado: "CANCELADO", version: 0 },
          { ...admin, medicoId: null },
        );
        await crearTurno({ ...p, pacienteId: otroPaciente.id });
        await assert.rejects(
          actualizarTurno(
            a.id,
            { estado: "CONFIRMADO", version: 1 },
            { ...admin, medicoId: null },
          ),
        );
      },
    );
    await caso(
      "cambios públicos obsoletos devuelven 409 y no pisan datos",
      async () => {
        const r = await anon.post(
          `/api/publico/mi-turno/${acceso.token}/cancelar`,
          { data: { turnoId: reservado, version: 99 } },
        );
        assert.equal(r.status(), 409);
        assert.equal(
          (await prisma.turno.findUniqueOrThrow({ where: { id: reservado } }))
            .estado,
          "PENDIENTE",
        );
      },
    );
    await caso(
      "reprogramar reinicia el recordatorio y conserva el historial",
      async () => {
        await prisma.turno.update({
          where: { id: reservado },
          data: { recordatorioEnviado: true },
        });
        const t = await reprogramarTurno({
          turnoId: reservado,
          pacienteId: paciente.id,
          version: 0,
          medicoId: medico.id,
          fecha: futuro,
          horaInicio: "10:15",
          realizadoPor: paciente.id,
        });
        assert.equal(t.recordatorioEnviado, false);
        assert.equal(t.version, 1);
      },
    );
    await caso(
      "la ficha médica detecta concurrencia y guarda revisiones sin tokens",
      async () => {
        const p = {
          versionFicha: 0,
          pesoKg: 70,
          alturaCm: 170,
          grupoSanguineo: "A+",
          alergias: "Penicilina",
          antecedentes: "Prueba",
        };
        const r = await doc.patch(
          `/api/pacientes/${paciente.id}/ficha-medica`,
          { data: p },
        );
        assert.equal(r.status(), 200);
        const data = await r.json();
        assert.equal(data.versionFicha, 1);
        assert(!("tokenAccesoEnc" in data));
        assert.equal(
          (
            await doc.patch(`/api/pacientes/${paciente.id}/ficha-medica`, {
              data: p,
            })
          ).status(),
          409,
        );
        assert.equal(
          await prisma.revisionFicha.count({
            where: { pacienteId: paciente.id },
          }),
          1,
        );
      },
    );
    await caso(
      "las notas conservan texto anterior, nuevo y autor",
      async () => {
        const r = await doc.patch(`/api/turnos/${nota.id}`, {
          data: {
            estado: "ATENDIDO",
            version: 1,
            notasMedico: "CLINICA_EDITADA",
          },
        });
        assert.equal(r.status(), 200);
        const revision = await prisma.revisionNota.findFirstOrThrow({
          where: { turnoId: nota.id },
        });
        assert.equal(revision.anterior, "CLINICA_SECRETA");
        assert.equal(revision.posterior, "CLINICA_EDITADA");
        assert.equal(revision.realizadoPor, doctor.id);
      },
    );
    await caso(
      "las ausencias se cuentan y se corrigen al revertir el estado",
      async () => {
        const t = await prisma.turno.create({
          data: {
            pacienteId: paciente.id,
            medicoId: medico.id,
            fecha: fechaDB(ayer),
            horaInicio: "07:00",
            horaFin: "07:15",
          },
        });
        await actualizarTurno(
          t.id,
          { estado: "AUSENTE", version: 0 },
          { ...admin, medicoId: null },
        );
        assert.equal(
          (
            await prisma.paciente.findUniqueOrThrow({
              where: { id: paciente.id },
            })
          ).ausenciasSinAviso,
          1,
        );
        await actualizarTurno(
          t.id,
          { estado: "CANCELADO", version: 1 },
          { ...admin, medicoId: null },
        );
        assert.equal(
          (
            await prisma.paciente.findUniqueOrThrow({
              where: { id: paciente.id },
            })
          ).ausenciasSinAviso,
          0,
        );
      },
    );
    await caso(
      "visitas futuras y pacientes sin relación se rechazan",
      async () => {
        const a = crearTokenAcceso();
        const sinRelacion = await prisma.paciente.create({
          data: {
            dni: "55667788",
            nombre: "Sin",
            apellido: "Relacion",
            email: "sin@example.test",
            tokenAccesoHash: a.tokenAccesoHash,
            tokenAccesoEnc: a.tokenAccesoEnc,
          },
        });
        assert.equal(
          (
            await doc.post(`/api/pacientes/${paciente.id}/visitas`, {
              data: { fecha: futuro, horaInicio: "15:00" },
            })
          ).status(),
          400,
        );
        assert.equal(
          (
            await doc.post(`/api/pacientes/${sinRelacion.id}/visitas`, {
              data: { fecha: ayer, horaInicio: "15:00" },
            })
          ).status(),
          403,
        );
      },
    );
    await caso(
      "licencias pendientes requieren aprobación y las aprobadas bloquean slots",
      async () => {
        let r = await doc.post("/api/bloqueos", {
          data: {
            medicoId: medico.id,
            fecha: futuro,
            horaInicio: "16:00",
            horaFin: "17:00",
            motivo: "Licencia de prueba",
          },
        });
        assert.equal(r.status(), 201);
        const b = await r.json();
        assert.equal(b.estado, "PENDIENTE");
        assert.equal(
          (
            await doc.patch(`/api/bloqueos/${b.id}`, {
              data: { estado: "APROBADO" },
            })
          ).status(),
          403,
        );
        r = await sec.patch(`/api/bloqueos/${b.id}`, {
          data: { estado: "APROBADO" },
        });
        assert.equal(r.status(), 200);
        const slots = await (
          await anon.get(
            `/api/publico/disponibilidad?medicoId=${medico.id}&fecha=${futuro}`,
          )
        ).json();
        assert(!slots.slots.includes("16:00"));
      },
    );
    await caso(
      "una licencia no puede aprobarse sobre citas reservadas",
      async () => {
        const r = await sec.post("/api/bloqueos", {
          data: {
            medicoId: medico.id,
            fecha: futuro,
            horaInicio: "10:00",
            horaFin: "11:00",
            motivo: "Conflicto de prueba",
          },
        });
        assert.equal(r.status(), 409);
      },
    );
    await caso(
      "anular un cobro conserva monto, autor y motivo; valida su turno",
      async () => {
        let r = await sec.post(`/api/turnos/${nota.id}/pagos`, {
          data: { monto: 100.5, metodo: "EFECTIVO" },
        });
        assert.equal(r.status(), 201);
        const pago = await r.json();
        assert.equal(
          (
            await sec.delete(`/api/turnos/${reservado}/pagos/${pago.id}`, {
              data: { motivo: "Corrección de prueba" },
            })
          ).status(),
          409,
        );
        r = await sec.delete(`/api/turnos/${nota.id}/pagos/${pago.id}`, {
          data: { motivo: "Corrección de prueba" },
        });
        assert.equal(r.status(), 200);
        const guardado = await prisma.pago.findUniqueOrThrow({
          where: { id: pago.id },
        });
        assert.equal(Number(guardado.monto), 100.5);
        assert(guardado.anuladoEl);
        assert.equal(guardado.anuladoPor, secretaria.id);
      },
    );
    await caso(
      "un usuario desactivado pierde API y páginas, aun con cookie vigente",
      async () => {
        await prisma.usuarioInterno.update({
          where: { id: secretaria.id },
          data: { activo: false },
        });
        assert.equal((await sec.get("/api/pacientes")).status(), 401);
        const pagina = await sec.get("/pacientes", { maxRedirects: 0 });
        const html = await pagina.text();
        assert(!html.includes(paciente.dni));
        assert([200, 307].includes(pagina.status()));
        await prisma.usuarioInterno.update({
          where: { id: secretaria.id },
          data: { activo: true },
        });
      },
    );
    await caso(
      "cambiar ADMIN a MEDICO recorta permisos heredados",
      async () => {
        const u = await prisma.usuarioInterno.create({
          data: {
            nombre: "Cambio",
            email: "cambio@example.test",
            password,
            rol: "ADMIN",
            permisos: null,
          },
        });
        const r = await adm.patch(`/api/admin/usuarios/${u.id}`, {
          data: {
            nombre: u.nombre,
            email: u.email,
            rol: "MEDICO",
            activo: true,
            medicoId: "",
          },
        });
        assert.equal(r.status(), 200);
        const actualizado = await prisma.usuarioInterno.findUniqueOrThrow({
          where: { id: u.id },
        });
        assert.deepEqual(JSON.parse(actualizado.permisos!), [
          "agenda",
          "bloqueos",
        ]);
      },
    );
    await caso(
      "los recordatorios fallidos permanecen pendientes y pueden reintentarse",
      async () => {
        const manana = sumarDias(fechaClinica(), 1);
        const t = await prisma.turno.create({
          data: {
            pacienteId: paciente.id,
            medicoId: medico.id,
            fecha: fechaDB(manana),
            horaInicio: "14:00",
            horaFin: "14:15",
          },
        });
        fallarCorreo = true;
        let r = await anon.get("/api/cron/recordatorios", {
          headers: { authorization: "Bearer cron-test-only" },
        });
        assert.equal(r.status(), 200);
        let guardado = await prisma.turno.findUniqueOrThrow({
          where: { id: t.id },
        });
        assert.equal(guardado.recordatorioEnviado, false);
        assert(guardado.recordatorioError);
        fallarCorreo = false;
        r = await anon.get("/api/cron/recordatorios", {
          headers: { authorization: "Bearer cron-test-only" },
        });
        assert.equal(r.status(), 200);
        guardado = await prisma.turno.findUniqueOrThrow({
          where: { id: t.id },
        });
        assert.equal(guardado.recordatorioEnviado, true);
        assert.equal(guardado.recordatorioError, null);
      },
    );
    await caso(
      "entradas inválidas devuelven 400 y se limitan solicitudes de código",
      async () => {
        assert.equal(
          (
            await anon.get(
              `/api/publico/disponibilidad?medicoId=${medico.id}&fecha=2099-02-31`,
            )
          ).status(),
          400,
        );
        await anon.post("/api/publico/recuperar", {
          data: { dni: paciente.dni },
        });
        assert.equal(
          (
            await anon.post("/api/publico/recuperar", {
              data: { dni: paciente.dni },
            })
          ).status(),
          429,
        );
      },
    );
    await caso(
      "el navegador muestra citas de 15 minutos y permite reservar sin cuenta",
      async () => {
        const browser = await chromium.launch({ headless: true });
        try {
          const page = await browser.newPage({
            viewport: { width: 1280, height: 900 },
          });
          await page.goto(baseURL + "/login");
          await page.getByLabel("Email", { exact: true }).fill(admin.email);
          await page
            .getByLabel("Contraseña", { exact: true })
            .fill("Prueba12345");
          await page
            .getByRole("button", { name: "Ingresar", exact: true })
            .click();
          await page.waitForURL("**/panel");
          await page.locator(".staff-content").waitFor();
          await mkdir("test-results", { recursive: true });
          await page.screenshot({
            path: "test-results/inicio-admin.png",
            fullPage: true,
          });
          await page.goto(baseURL + "/turnos");
          await page.getByLabel("Fecha", { exact: true }).fill(futuro);
          await page
            .getByRole("button", { name: /10:15.*Titular/ })
            .waitFor()
            .catch(async (error) => {
              await page.screenshot({
                path: "test-results/agenda-error.png",
                fullPage: true,
              });
              console.error(await page.locator("body").innerText());
              throw error;
            });
          await page.screenshot({
            path: "test-results/agenda-escritorio.png",
            fullPage: true,
          });
          await page.context().clearCookies();
          await page.goto(baseURL + "/");
          await page.screenshot({
            path: "test-results/portada-escritorio.png",
            fullPage: true,
          });
          await page.goto(baseURL + "/reservar");
          await page.getByRole("button", { name: /Prueba, Medico/ }).click();
          await page.getByLabel("Fecha", { exact: true }).fill(futuro);
          await page
            .getByRole("button", { name: "13:15", exact: true })
            .waitFor();
          await page.screenshot({
            path: "test-results/reserva-horarios.png",
            fullPage: true,
          });
          await page
            .getByRole("button", { name: "13:15", exact: true })
            .click();
          await page.getByLabel("DNI", { exact: true }).fill("45678901");
          await page.getByLabel("Nombre", { exact: true }).fill("Navegador");
          await page.getByLabel("Apellido", { exact: true }).fill("Paciente");
          await page.getByLabel("Teléfono", { exact: true }).fill("12345678");
          await page
            .getByLabel("Email", { exact: true })
            .fill("browser@example.test");
          await page.route("**/api/publico/verificacion", (route) =>
            route.abort(),
          );
          await page
            .getByRole("button", { name: "Recibir código", exact: true })
            .click();
          await page.locator(".booking-card").getByRole("alert").waitFor();
          assert(
            await page
              .getByRole("button", { name: "Recibir código", exact: true })
              .isEnabled(),
          );
          await page.unroute("**/api/publico/verificacion");
          await page
            .getByRole("button", { name: "Recibir código", exact: true })
            .click();
          await page.getByLabel("Código de seis dígitos").waitFor();
          await page
            .getByLabel("Código de seis dígitos")
            .fill(codigoPara("browser@example.test"));
          await page
            .getByRole("button", { name: "Confirmar reserva", exact: true })
            .click();
          await page
            .getByRole("heading", { name: "¡Turno reservado!" })
            .waitFor();
          await mkdir("test-results", { recursive: true });
          await page.screenshot({
            path: "test-results/reserva-verificada.png",
            fullPage: true,
          });
        } finally {
          await browser.close();
        }
      },
    );
    await caso(
      "el rediseño conserva la navegación por rol y se adapta al celular",
      async () => {
        const browser = await chromium.launch({ headless: true });
        await mkdir("test-results", { recursive: true });
        try {
          for (const [perfil, api, rutas] of [
            [
              "admin",
              adm,
              [
                "/panel",
                "/pacientes",
                "/pacientes/nuevo",
                `/pacientes/${paciente.id}`,
                "/medicos",
                "/medicos/nuevo",
                `/medicos/${medico.id}`,
                "/especialidades",
                "/admin/usuarios",
                "/admin/usuarios/nuevo",
                `/admin/usuarios/${doctor.id}`,
                "/turnos/nuevo",
                "/reportes",
                "/bloqueos",
              ],
            ],
            ["secretaria", sec, ["/panel", "/turnos", "/pacientes"]],
            [
              "medico",
              doc,
              ["/panel", "/agenda", `/turnos/${nota.id}`, "/bloqueos"],
            ],
          ] as const) {
            const context = await browser.newContext({
              storageState: await api.storageState(),
              viewport: { width: 1440, height: 1000 },
            });
            const page = await context.newPage();
            for (const ruta of rutas) {
              const response = await page.goto(baseURL + ruta);
              assert.equal(response?.status(), 200, `${perfil} ${ruta}`);
              await page.locator(".staff-content").waitFor();
              assert.equal(new URL(page.url()).pathname, ruta);
              if (ruta === "/panel") {
                const nav = page.getByRole("navigation", {
                  name: "Navegación principal",
                });
                assert.equal(
                  await nav
                    .getByRole("link", { name: "Usuarios", exact: true })
                    .count(),
                  perfil === "admin" ? 1 : 0,
                );
                assert.equal(
                  await nav
                    .getByRole("link", { name: "Pacientes", exact: true })
                    .count(),
                  perfil === "medico" ? 0 : 1,
                );
              }
              await page.screenshot({
                path: `test-results/${perfil}-${ruta.replaceAll("/", "-")}-desktop.png`,
                fullPage: true,
              });
              await page.setViewportSize({ width: 390, height: 844 });
              assert(
                await page.evaluate(
                  () => document.documentElement.scrollWidth <= innerWidth,
                ),
                `Sin desborde: ${perfil} ${ruta}`,
              );
              await page.screenshot({
                path: `test-results/${perfil}-${ruta.replaceAll("/", "-")}-mobile.png`,
                fullPage: true,
              });
              await page.setViewportSize({ width: 320, height: 800 });
              assert(
                await page.evaluate(
                  () => document.documentElement.scrollWidth <= innerWidth,
                ),
                `Sin desborde a 320px: ${perfil} ${ruta}`,
              );
              await page.setViewportSize({ width: 390, height: 844 });
              if (ruta === "/panel") {
                await page
                  .getByRole("button", { name: "Abrir menú", exact: true })
                  .click();
                await page
                  .getByRole("navigation", { name: "Navegación principal" })
                  .getByRole("link", { name: "Inicio", exact: true })
                  .click();
                assert.equal(
                  await page
                    .getByRole("button", { name: "Abrir menú", exact: true })
                    .getAttribute("aria-expanded"),
                  "false",
                );
                await page
                  .getByRole("button", { name: "Abrir menú", exact: true })
                  .click();
                await page.keyboard.press("Escape");
                assert.equal(
                  await page
                    .getByRole("button", { name: "Abrir menú", exact: true })
                    .getAttribute("aria-expanded"),
                  "false",
                );
              }
              await page.setViewportSize({ width: 1440, height: 1000 });
            }
            await context.close();
          }
          const page = await browser.newPage({
            viewport: { width: 390, height: 844 },
          });
          for (const ruta of [
            "/",
            "/reservar",
            "/mi-turno/recuperar",
            "/login",
            `/mi-turno/${acceso.token}`,
          ]) {
            await page.goto(baseURL + ruta);
            if (ruta.startsWith("/mi-turno/") && ruta !== "/mi-turno/recuperar")
              await page
                .getByRole("heading", { name: "Próximos turnos", exact: true })
                .waitFor();
            assert(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
              ),
              `Sin desborde público: ${ruta}`,
            );
            await page.screenshot({
              path: `test-results/publico-${ruta.startsWith("/mi-turno/") && ruta !== "/mi-turno/recuperar" ? "mis-turnos" : ruta.replaceAll("/", "-") || "inicio"}-mobile.png`,
              fullPage: true,
            });
            await page.setViewportSize({ width: 320, height: 800 });
            assert(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
              ),
              `Sin desborde público a 320px: ${ruta}`,
            );
            await page.setViewportSize({ width: 390, height: 844 });
          }
        } finally {
          await browser.close();
        }
      },
    );
    console.log(
      `\n${casos} pruebas de integración correctas. PostgreSQL y correos exclusivamente locales.`,
    );
  } catch (error) {
    console.error(error);
    console.error(appLogs);
    process.exitCode = 1;
  } finally {
    for (const c of contexts) await c.dispose();
    if (app) await finalizarProceso(app);
    if (cerrarPrisma) await cerrarPrisma();
    if (mail.listening) await new Promise<void>((r) => mail.close(() => r()));
    await pg.stop().catch(() => {});
    // Únicamente se elimina el directorio creado por esta ejecución, dentro de TEMP.
    if (
      path.dirname(temporalAbsoluto) === path.resolve(tmpdir()) &&
      path.basename(temporalAbsoluto).startsWith("clinica-test-")
    )
      await rm(temporalAbsoluto, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 100,
      });
  }
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
