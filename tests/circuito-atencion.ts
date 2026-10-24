import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { chromium, webkit, type APIRequestContext } from "@playwright/test";
import type { PrismaClient } from "../app/generated/prisma/client";
import { fechaClinica, fechaDB, sumarDias } from "../lib/fecha";

export async function pruebasCircuito({
  prisma,
  sec,
  adm,
  anon,
  baseURL,
  futuro,
  caso,
  correos,
  cliente,
  fallarCorreo,
}: {
  prisma: PrismaClient;
  sec: APIRequestContext;
  adm: APIRequestContext;
  anon: APIRequestContext;
  baseURL: string;
  futuro: string;
  caso: (nombre: string, fn: () => Promise<void>) => Promise<void>;
  correos: { to: string[]; subject: string; text: string; html: string }[];
  cliente: (email?: string, clave?: string) => Promise<APIRequestContext>;
  fallarCorreo: (valor: boolean) => void;
}) {
  const { crearTokenAcceso } = await import("../lib/pacientes");
  const { crearTurno, reprogramarTurno } = await import("../lib/turnos");
  const { procesarAvisosTurno } = await import("../lib/avisos-turno");
  const especialidad = await prisma.especialidad.findFirstOrThrow();
  const fecha = sumarDias(futuro, 100),
    clave = "Circuito-Prueba-2026!";
  const medicos = await Promise.all(
    ["A", "B"].map((apellido) =>
      prisma.medico.create({
        data: {
          nombre: "Circuito",
          apellido,
          especialidadId: especialidad.id,
          duracionTurnoMinutos: 15,
        },
      }),
    ),
  );
  const dias = [
    "LUNES",
    "MARTES",
    "MIERCOLES",
    "JUEVES",
    "VIERNES",
    "SABADO",
    "DOMINGO",
  ] as const;
  await prisma.horarioMedico.createMany({
    data: medicos.flatMap((m) =>
      dias.map((diaSemana) => ({
        medicoId: m.id,
        diaSemana,
        horaInicio: "09:00",
        horaFin: "19:00",
      })),
    ),
  });
  const cuentas = await Promise.all(
    medicos.map(async (m, i) =>
      prisma.usuarioInterno.create({
        data: {
          nombre: `Circuito ${i}`,
          email: `circuito-${i}@example.test`,
          password: await bcrypt.hash(clave, 10),
          medicoId: m.id,
          rol: "MEDICO",
        },
      }),
    ),
  );
  const doc = await cliente(cuentas[0].email, clave),
    otroDoc = await cliente(cuentas[1].email, clave);
  let numero = 78123000;
  async function paciente() {
    const acceso = crearTokenAcceso(),
      dni = String(numero++);
    const p = await prisma.paciente.create({
      data: {
        dni,
        nombre: "Paciente",
        apellido: `Circuito ${dni}`,
        email: `${dni}@example.test`,
        telefono: "11 2233-4455",
        tokenAccesoHash: acceso.tokenAccesoHash,
        tokenAccesoEnc: acceso.tokenAccesoEnc,
      },
    });
    return { ...p, token: acceso.token };
  }
  const titular = await paciente();
  async function crear(
    pacienteId: string,
    horaInicio: string,
    dia = fecha,
    medicoId = medicos[0].id,
    online = false,
  ) {
    return crearTurno({
      pacienteId,
      medicoId,
      fecha: dia,
      horaInicio,
      canalReserva: online ? "ONLINE" : "PRESENCIAL",
      realizadoPor: "prueba-circuito",
    });
  }
  async function esperar(fn: () => Promise<boolean>, mensaje: string) {
    const limite = Date.now() + 12000;
    while (!(await fn())) {
      if (Date.now() > limite) throw Error(mensaje);
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  const solicitud = await crear(
    titular.id,
    "10:00",
    fecha,
    medicos[0].id,
    true,
  );
  await caso(
    "la solicitud pendiente informa su estado y la aprobación envía una confirmación diferente",
    async () => {
      const aviso = await prisma.avisoTurno.findFirstOrThrow({
        where: { turnoId: solicitud.id },
      });
      await procesarAvisosTurno([aviso.id]);
      assert(
        correos.some(
          (c) =>
            c.to.includes(titular.email!) &&
            c.subject === "Solicitud de turno recibida" &&
            c.text.includes("pendiente de confirmación"),
        ),
      );
      assert(
        !correos.some(
          (c) =>
            c.to.includes(titular.email!) && c.subject === "Turno confirmado",
        ),
      );
      assert.equal(
        (
          await sec.patch(`/api/turnos/${solicitud.id}`, {
            data: {
              estado: "CONFIRMADO",
              version: 0,
              notasSecretaria: "Seguimiento administrativo",
            },
          })
        ).status(),
        200,
      );
      await esperar(
        async () =>
          !!(await prisma.avisoTurno.findFirst({
            where: {
              turnoId: solicitud.id,
              tipo: "CONFIRMACION",
              enviado: true,
            },
          })),
        "Debe enviarse la confirmación real",
      );
      assert(
        correos.some(
          (c) =>
            c.to.includes(titular.email!) && c.subject === "Turno confirmado",
        ),
      );
      const n = await prisma.avisoTurno.count({
        where: { turnoId: solicitud.id },
      });
      assert.equal(
        (
          await sec.patch(`/api/turnos/${solicitud.id}`, {
            data: { estado: "CONFIRMADO", version: 1 },
          })
        ).status(),
        200,
      );
      assert.equal(
        await prisma.avisoTurno.count({ where: { turnoId: solicitud.id } }),
        n,
        "Guardar notas no duplica la confirmación",
      );
    },
  );
  await caso(
    "secretaría reprograma conservando el turno, notas e historial; versiones obsoletas y médicos quedan bloqueados",
    async () => {
      const actual = await prisma.turno.findUniqueOrThrow({
        where: { id: solicitud.id },
      });
      const data = {
        medicoId: medicos[0].id,
        fecha: sumarDias(fecha, 1),
        horaInicio: "12:00",
        version: actual.version,
      };
      assert.equal(
        (
          await anon.post(`/api/turnos/${solicitud.id}/reprogramar`, { data })
        ).status(),
        401,
      );
      assert.equal(
        (
          await doc.post(`/api/turnos/${solicitud.id}/reprogramar`, { data })
        ).status(),
        403,
      );
      const r = await sec.post(`/api/turnos/${solicitud.id}/reprogramar`, {
        data,
      });
      assert.equal(r.status(), 200, await r.text());
      const t = await prisma.turno.findUniqueOrThrow({
        where: { id: solicitud.id },
        include: { historial: true },
      });
      assert.equal(t.estado, "CONFIRMADO");
      assert.equal(t.horaInicio, "12:00");
      assert.equal(t.notasSecretaria, "Seguimiento administrativo");
      assert(t.historial.some((h) => h.detalle?.includes("Reprogramado")));
      assert.equal(
        (
          await sec.post(`/api/turnos/${solicitud.id}/reprogramar`, { data })
        ).status(),
        409,
      );
      await esperar(
        async () =>
          !!(await prisma.avisoTurno.findFirst({
            where: { turnoId: t.id, tipo: "REPROGRAMACION", enviado: true },
          })),
        "Se avisa el nuevo horario",
      );
      await adm.patch(`/api/turnos/${t.id}`, {
        data: {
          estado: t.estado,
          version: t.version,
          notasMedico: "Nota privada del profesional original",
        },
      });
      const vigente = await prisma.turno.findUniqueOrThrow({
        where: { id: t.id },
      });
      assert.equal(
        (
          await sec.post(`/api/turnos/${t.id}/reprogramar`, {
            data: {
              ...data,
              medicoId: medicos[1].id,
              version: vigente.version,
            },
          })
        ).status(),
        400,
      );
    },
  );
  await caso(
    "un paciente no puede reservar dos profesionales superpuestos, incluso con solicitudes simultáneas",
    async () => {
      const p = await paciente();
      const r = await Promise.allSettled(
        medicos.map((m) => crear(p.id, "14:00", fecha, m.id)),
      );
      assert.equal(r.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal(
        await prisma.turno.count({ where: { pacienteId: p.id } }),
        1,
      );
      const otra = await crear(p.id, "15:00", fecha, medicos[1].id);
      await assert.rejects(
        reprogramarTurno({
          turnoId: otra.id,
          pacienteId: p.id,
          version: 0,
          medicoId: medicos[1].id,
          fecha,
          horaInicio: "14:00",
          realizadoPor: "prueba",
          interno: true,
        }),
        /no se superponga|no está disponible/,
      );
      assert.equal(
        (await prisma.turno.findUniqueOrThrow({ where: { id: otra.id } }))
          .horaInicio,
        "15:00",
      );
    },
  );
  await caso(
    "la próxima disponibilidad respeta días bloqueados, vigencias y horario del profesional",
    async () => {
      const dia = sumarDias(fecha, 5);
      const bloqueo = await prisma.bloqueoMedico.create({
        data: {
          medicoId: medicos[0].id,
          fecha: fechaDB(dia),
          estado: "APROBADO",
        },
      });
      try {
        const url = `/api/publico/disponibilidad?medicoId=${medicos[0].id}&fecha=${dia}&proxima=1`;
        const r = await anon.get(url);
        assert.equal(r.status(), 200);
        assert.deepEqual((await r.json()).proxima, {
          fecha: sumarDias(dia, 1),
          horaInicio: "09:00",
        });
        assert.equal(
          (await anon.get(url.replace(dia, "2026-02-31"))).status(),
          400,
        );
      } finally {
        await prisma.bloqueoMedico.delete({ where: { id: bloqueo.id } });
      }
    },
  );
  await caso(
    "los datos personales detectan ediciones concurrentes y registran valores y autor sin exponer enlaces",
    async () => {
      const data = {
        dni: titular.dni,
        nombre: titular.nombre,
        apellido: titular.apellido,
        email: titular.email,
        telefono: "11 3344-5566",
        fechaNacimiento: "",
        obraSocial: "Prueba",
        versionDatos: 0,
      };
      const r = await sec.patch(`/api/pacientes/${titular.id}`, { data });
      assert.equal(r.status(), 200, await r.text());
      assert.equal(
        (
          await sec.patch(`/api/pacientes/${titular.id}`, {
            data: { ...data, telefono: "11 9999-9999" },
          })
        ).status(),
        409,
      );
      const historia = await sec.get(
        `/api/pacientes/${titular.id}/datos-revisiones`,
      );
      const rows = await historia.json();
      assert.equal(rows.length, 1);
      assert.equal(rows[0].anterior.telefono, titular.telefono);
      assert.equal(rows[0].posterior.telefono, data.telefono);
      assert(rows[0].autor);
      assert(!JSON.stringify(rows).includes(titular.token));
      assert.equal(
        (
          await doc.get(`/api/pacientes/${titular.id}/datos-revisiones`)
        ).status(),
        403,
      );
    },
  );
  await caso(
    "la bandeja separa reservas, reprogramaciones y avisos fallidos y permite reintentar con permisos",
    async () => {
      const p = await paciente();
      const t = await crear(p.id, "11:00", sumarDias(fecha, 8));
      const aviso = await prisma.avisoTurno.findFirstOrThrow({
        where: { turnoId: t.id },
      });
      fallarCorreo(true);
      try {
        await procesarAvisosTurno([aviso.id]);
      } finally {
        fallarCorreo(false);
      }
      assert.equal((await anon.get("/api/turnos/pendientes")).status(), 401);
      assert.equal((await doc.get("/api/turnos/pendientes")).status(), 403);
      const lista = await (
        await sec.get("/api/turnos/pendientes?tipo=avisos")
      ).json();
      assert(lista.entradas.some((e: { id: string }) => e.id === aviso.id));
      const r = await sec.post("/api/turnos/pendientes/reintentar", {
        data: { tipo: "aviso", id: aviso.id },
      });
      assert.equal(r.status(), 200);
      assert.equal(
        (await prisma.avisoTurno.findUniqueOrThrow({ where: { id: aviso.id } }))
          .enviado,
        true,
      );
    },
  );
  await caso(
    "llegada, espera y consulta se coordinan por rol y no pueden registrarse para una fecha futura",
    async () => {
      const p = await paciente();
      const t = await prisma.turno.create({
        data: {
          pacienteId: p.id,
          medicoId: medicos[0].id,
          fecha: fechaDB(fechaClinica()),
          horaInicio: "09:00",
          horaFin: "09:15",
          estado: "CONFIRMADO",
        },
      });
      for (const [estado, version] of [
        ["LLEGO", 0],
        ["EN_ESPERA", 1],
      ] as const)
        assert.equal(
          (
            await sec.patch(`/api/turnos/${t.id}`, {
              data: { estado, version },
            })
          ).status(),
          200,
        );
      assert.equal(
        (
          await sec.patch(`/api/turnos/${t.id}`, {
            data: { estado: "EN_CONSULTA", version: 2 },
          })
        ).status(),
        403,
      );
      assert.equal(
        (
          await doc.patch(`/api/turnos/${t.id}`, {
            data: { estado: "EN_CONSULTA", version: 2 },
          })
        ).status(),
        200,
      );
      assert.equal(
        (
          await doc.patch(`/api/turnos/${t.id}`, {
            data: { estado: "ATENDIDO", version: 3 },
          })
        ).status(),
        200,
      );
      const futuro = await crear(p.id, "09:00", sumarDias(fecha, 20));
      assert.equal(
        (
          await sec.patch(`/api/turnos/${futuro.id}`, {
            data: { estado: "LLEGO", version: 0 },
          })
        ).status(),
        400,
      );
    },
  );
  const paraNotas = await crear(titular.id, "11:00", sumarDias(fecha, 15));
  await caso(
    "los borradores clínicos persisten por autor y rechazan accesos ajenos y sobrescrituras entre pestañas",
    async () => {
      const url = `/api/borradores/nota/${paraNotas.id}`,
        data = {
          contenido: { notasMedico: "BORRADOR_PRIVADO" },
          versionBase: 0,
          revision: 0,
        };
      assert.equal((await anon.get(url)).status(), 401);
      assert.equal((await sec.get(url)).status(), 403);
      assert.equal((await otroDoc.get(url)).status(), 403);
      assert.equal((await doc.put(url, { data })).status(), 200);
      assert.equal((await doc.put(url, { data })).status(), 409);
      assert.equal(
        (await prisma.turno.findUniqueOrThrow({ where: { id: paraNotas.id } }))
          .notasMedico,
        null,
      );
      assert.equal(
        (await (await doc.get(url)).json()).borrador.contenido.notasMedico,
        "BORRADOR_PRIVADO",
      );
      const borradorId = (await (await doc.get(url)).json()).borrador.id;
      await doc.delete(url, { data: { revision: 0, borradorId } });
      assert((await (await doc.get(url)).json()).borrador);
      await doc.delete(url, { data: { revision: 1, borradorId } });
      assert.equal((await (await doc.get(url)).json()).borrador, null);
      await doc.put(url, { data });
      const nuevoId = (await (await doc.get(url)).json()).borrador.id;
      assert.notEqual(nuevoId, borradorId);
      await doc.delete(url, { data: { revision: 1, borradorId } });
      assert.equal((await (await doc.get(url)).json()).borrador.id, nuevoId);
      assert.equal(
        (
          await doc.put(url, { data: { ...data, revision: 1, borradorId } })
        ).status(),
        409,
      );
      await doc.delete(url, { data: { revision: 1, borradorId: nuevoId } });
    },
  );
  for (const [nombre, engine] of Object.entries({
    Chromium: chromium,
    iPhone: webkit,
  })) {
    await caso(
      `${nombre}: la ficha unificada conserva borradores, avisa al salir y admite notas clínicas extensas`,
      async () => {
        const browser = await engine.launch();
        try {
          const context = await browser.newContext({
            storageState: await doc.storageState(),
            viewport: { width: nombre === "iPhone" ? 390 : 1280, height: 844 },
            ...(nombre === "iPhone" ? { isMobile: true, hasTouch: true } : {}),
          });
          const page = await context.newPage();
          await page.goto(`${baseURL}/agenda`);
          const listo = page.waitForResponse(
            (r) =>
              r.url().endsWith(`/api/borradores/nota/${paraNotas.id}`) &&
              r.status() === 200,
          );
          await page.goto(`${baseURL}/turnos/${paraNotas.id}`);
          await listo;
          const textarea = page.getByLabel("Notas clínicas (médico)", {
            exact: true,
          });
          const contenido =
            `${nombre} ` + "Evolución clínica de prueba. ".repeat(80);
          assert.equal(await textarea.getAttribute("maxlength"), "20000");
          await textarea.fill(contenido);
          try {
            await page
              .getByText("Borrador privado guardado.", { exact: true })
              .waitFor({ timeout: 12000 });
          } catch (error) {
            console.log({
              navegador: nombre,
              inicioCampo: (await textarea.inputValue()).slice(0, 20),
              avisos: await page.locator('[role="status"]').allTextContents(),
            });
            throw error;
          }
          const atras = page.waitForEvent("dialog");
          const retroceso = page
            .goBack({ waitUntil: "domcontentloaded" })
            .catch(() => null);
          await (await atras).dismiss();
          await retroceso;
          assert(page.url().includes(`/turnos/${paraNotas.id}`));
          const atencion = page.waitForEvent("dialog");
          const click = page
            .getByRole("link", {
              name: "Ver ficha, notas y archivos del paciente",
            })
            .click();
          await (await atencion).dismiss();
          await click;
          assert(page.url().includes(`/turnos/${paraNotas.id}`));
          const salida = page.waitForEvent("dialog");
          const abrir = page
            .getByRole("link", {
              name: "Ver ficha, notas y archivos del paciente",
            })
            .click();
          await (await salida).accept();
          await abrir;
          await page.waitForURL(`**/pacientes/${titular.id}`);
          await page
            .getByRole("heading", { name: "Ficha médica", exact: true })
            .waitFor();
          await page.goto(`${baseURL}/turnos/${paraNotas.id}`);
          await page
            .getByRole("button", { name: "Restaurar borrador", exact: true })
            .click();
          assert.equal(await textarea.inputValue(), contenido);
          assert(
            !(await page
              .evaluate(() => JSON.stringify(localStorage))
              .then((v) => v.includes("Evolución clínica"))),
          );
          await page
            .getByRole("button", { name: "Guardar cambios", exact: true })
            .click();
          await esperar(
            async () =>
              (
                await prisma.turno.findUniqueOrThrow({
                  where: { id: paraNotas.id },
                })
              ).notasMedico === contenido.trim(),
            "La nota extensa debe persistir",
          );
          await esperar(
            async () =>
              !(await prisma.borradorClinico.findFirst({
                where: {
                  usuarioId: cuentas[0].id,
                  tipo: "nota",
                  referenciaId: paraNotas.id,
                },
              })),
            "Se elimina únicamente el borrador guardado",
          );
          assert(
            !(await page.evaluate(
              () => document.documentElement.scrollWidth > innerWidth,
            )),
          );
        } finally {
          await browser.close();
        }
      },
    );
  }
  await caso(
    "las notas demasiado extensas se rechazan sin modificar la consulta",
    async () => {
      const t = await prisma.turno.findUniqueOrThrow({
        where: { id: paraNotas.id },
      });
      assert.equal(
        (
          await doc.patch(`/api/turnos/${t.id}`, {
            data: {
              version: t.version,
              estado: t.estado,
              notasMedico: "x".repeat(20001),
            },
          })
        ).status(),
        400,
      );
      assert.equal(
        (await prisma.turno.findUniqueOrThrow({ where: { id: t.id } })).version,
        t.version,
      );
    },
  );
  await caso(
    "el paciente ve la confirmación automáticamente sin recargar su panel",
    async () => {
      const p = await paciente();
      const t = await crear(
        p.id,
        "16:00",
        sumarDias(fecha, 25),
        medicos[0].id,
        true,
      );
      const browser = await chromium.launch();
      try {
        const page = await browser.newPage();
        await page.goto(`${baseURL}/mi-turno/${p.token}`);
        await page.getByText("Pendiente", { exact: true }).waitFor();
        assert.equal(
          (
            await sec.patch(`/api/turnos/${t.id}`, {
              data: { estado: "CONFIRMADO", version: 0 },
            })
          ).status(),
          200,
        );
        await page
          .getByText("Confirmado", { exact: true })
          .waitFor({ timeout: 10000 });
      } finally {
        await browser.close();
      }
    },
  );
  await caso(
    "el paciente puede elegir la próxima disponibilidad desde el formulario de reserva",
    async () => {
      const browser = await chromium.launch();
      try {
        const page = await browser.newPage({
          viewport: { width: 390, height: 844 },
        });
        await page.goto(baseURL + "/reservar");
        await page.getByRole("button", { name: /A, Circuito/ }).click();
        await page.getByLabel("Fecha", { exact: true }).fill(fecha);
        await page
          .getByRole("button", {
            name: "Ver próxima disponibilidad",
            exact: true,
          })
          .click();
        await page.getByLabel("DNI", { exact: true }).waitFor();
      } finally {
        await browser.close();
      }
    },
  );
  await caso(
    "cambiar la contraseña propia invalida las sesiones anteriores y exige la contraseña actual",
    async () => {
      const cuenta = await prisma.usuarioInterno.create({
        data: {
          nombre: "Cuenta Propia",
          email: "cuenta-propia@example.test",
          rol: "SECRETARIA",
          password: await bcrypt.hash(clave, 10),
        },
      });
      const api = await cliente(cuenta.email, clave),
        nueva = "Nueva-Clave-Segura-2026!";
      assert.equal(
        (
          await anon.post("/api/cuenta/clave", {
            data: { actual: clave, nueva, confirmacion: nueva },
          })
        ).status(),
        401,
      );
      assert.equal(
        (
          await api.post("/api/cuenta/clave", {
            data: { actual: "incorrecta", nueva, confirmacion: nueva },
          })
        ).status(),
        400,
      );
      assert.equal(
        (
          await api.post("/api/cuenta/clave", {
            data: { actual: clave, nueva, confirmacion: nueva },
          })
        ).status(),
        200,
      );
      assert.equal((await api.get("/api/turnos/pendientes")).status(), 401);
      const vigente = await cliente(cuenta.email, nueva);
      assert.equal((await vigente.get("/api/turnos/pendientes")).status(), 200);
      assert(
        await bcrypt.compare(
          nueva,
          (
            await prisma.usuarioInterno.findUniqueOrThrow({
              where: { id: cuenta.id },
            })
          ).password,
        ),
      );
    },
  );
  await caso(
    "la recuperación es genérica, de un uso, vence e invalida las sesiones de la contraseña anterior",
    async () => {
      const email = "cuenta-propia@example.test",
        nueva = "Clave-Recuperada-2026!";
      const api = await cliente(email, "Nueva-Clave-Segura-2026!");
      const a = await anon.post("/api/cuenta/recuperar", { data: { email } });
      const b = await anon.post("/api/cuenta/recuperar", {
        data: { email: "no-existe@example.test" },
      });
      assert.equal(a.status(), 200);
      assert.deepEqual(await a.json(), await b.json());
      await esperar(
        async () =>
          correos.some(
            (c) =>
              c.to.includes(email) &&
              c.subject === "Restablecer tu contraseña del panel",
          ),
        "Debe llegar un enlace de recuperación local",
      );
      const mail = [...correos]
        .reverse()
        .find(
          (c) =>
            c.to.includes(email) &&
            c.subject === "Restablecer tu contraseña del panel",
        )!;
      const token = mail.text.match(
        /\/login\/restablecer\?token=([A-Za-z0-9_-]{43})/,
      )![1];
      const data = { token, nueva, confirmacion: nueva };
      assert.equal(
        (await anon.post("/api/cuenta/restablecer", { data })).status(),
        200,
      );
      assert.equal(
        (await anon.post("/api/cuenta/restablecer", { data })).status(),
        400,
      );
      assert.equal((await api.get("/api/turnos/pendientes")).status(), 401);
      await cliente(email, nueva);
      const { solicitarRecuperacion } = await import("../lib/cuenta");
      const { hashToken } = await import("../lib/token");
      await solicitarRecuperacion(email);
      const ultimo = [...correos]
        .reverse()
        .find(
          (c) =>
            c.to.includes(email) &&
            c.subject === "Restablecer tu contraseña del panel",
        )!;
      const vencido = ultimo.text.match(
        /\/login\/restablecer\?token=([A-Za-z0-9_-]{43})/,
      )![1];
      await prisma.recuperacionCuenta.update({
        where: { tokenHash: hashToken(vencido) },
        data: { venceEl: new Date(Date.now() - 1000) },
      });
      assert.equal(
        (
          await anon.post("/api/cuenta/restablecer", {
            data: { ...data, token: vencido },
          })
        ).status(),
        400,
      );
      const inactiva = await prisma.usuarioInterno.create({
        data: {
          nombre: "Cuenta inactiva",
          email: "recuperacion-inactiva@example.test",
          rol: "SECRETARIA",
          activo: false,
          password: await bcrypt.hash(clave, 10),
        },
      });
      try {
        const antes = await prisma.recuperacionCuenta.count();
        const correosAntes = correos.length;
        await solicitarRecuperacion(inactiva.email);
        assert.equal(await prisma.recuperacionCuenta.count(), antes);
        assert.equal(correos.length, correosAntes);
      } finally {
        await prisma.usuarioInterno.delete({ where: { id: inactiva.id } });
      }
    },
  );
}
