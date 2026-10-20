import assert from "node:assert/strict";
import { chromium, type APIRequestContext } from "@playwright/test";
import type { PrismaClient } from "../app/generated/prisma/client";
import { fechaDB, sumarDias, fechaClinica } from "../lib/fecha";
import type { ConflictoLicencia } from "../lib/bloqueos";

export async function pruebasLicencias({
  prisma,
  doc,
  sec,
  anon,
  baseURL,
  futuro,
  medicoId,
  caso,
  correos,
  fallarCorreo,
}: {
  prisma: PrismaClient;
  doc: APIRequestContext;
  sec: APIRequestContext;
  anon: APIRequestContext;
  baseURL: string;
  futuro: string;
  medicoId: string;
  caso: (nombre: string, fn: () => Promise<void>) => Promise<void>;
  correos: { to: string[]; subject: string; text: string; html: string }[];
  fallarCorreo: (fallar: boolean) => void;
}) {
  const { crearTokenAcceso } = await import("../lib/pacientes");
  const { crearTurno } = await import("../lib/turnos");
  const { procesarAvisosReprogramacion } =
    await import("../lib/avisos-reprogramacion");
  const acceso = crearTokenAcceso();
  const paciente = await prisma.paciente.create({
    data: {
      nombre: "Paciente <Licencia>",
      apellido: "Prueba",
      dni: "74123450",
      email: "licencia@example.test",
      telefono: "1155550202",
      tokenAccesoHash: acceso.tokenAccesoHash,
      tokenAccesoEnc: acceso.tokenAccesoEnc,
    },
  });
  const fecha = sumarDias(futuro, 63);
  const otroMedico = await prisma.medico.findFirstOrThrow({
    where: { id: { not: medicoId }, activo: true },
  });
  const crear = (horaInicio: string) =>
    crearTurno({
      pacienteId: paciente.id,
      medicoId,
      fecha,
      horaInicio,
      canalReserva: horaInicio === "09:00" ? "PRESENCIAL" : "ONLINE",
      realizadoPor: "prueba:licencia",
    });
  const turnos = [
    await crear("09:00"),
    await crear("09:15"),
    await crear("09:30"),
  ];
  const exterior = await crear("10:00");
  const datos = {
    medicoId,
    fecha,
    horaInicio: "09:00",
    horaFin: "10:00",
    motivo: "Licencia directa de prueba",
  };
  let conflictos: ConflictoLicencia[] = [];
  let correoInicial = 0;
  async function esperarAvisos(ids: string[]) {
    const hasta = Date.now() + 15000;
    while (Date.now() < hasta) {
      const pendientes = await prisma.turno.count({
        where: { id: { in: ids }, avisoReprogramacionEnviado: false },
      });
      if (!pendientes) return;
      await new Promise((r) => setTimeout(r, 100));
    }
    assert.fail("Los avisos deben enviarse en el receptor local");
  }
  await caso(
    "la licencia muestra todos los turnos coincidentes sin modificar la agenda ni enviar correos antes de confirmar",
    async () => {
      assert.equal(
        (await anon.post("/api/bloqueos", { data: datos })).status(),
        401,
      );
      assert.equal(
        (
          await doc.post("/api/bloqueos", {
            data: { ...datos, medicoId: otroMedico.id },
          })
        ).status(),
        403,
      );
      const cantidad = await prisma.bloqueoMedico.count();
      correoInicial = correos.length;
      const preview = await doc.post("/api/bloqueos", { data: datos });
      assert.equal(preview.status(), 409);
      const body = await preview.json();
      conflictos = body.conflictos;
      assert.equal(body.codigo, "TURNOS_COINCIDENTES");
      assert.equal(conflictos.length, 3);
      assert(
        conflictos.every(
          (t) => t.paciente.nombre === paciente.nombre && t.tieneEmail,
        ),
      );
      assert(!JSON.stringify(body).includes("tokenAcceso"));
      assert(!JSON.stringify(body).includes("notasMedico"));
      assert.equal(await prisma.bloqueoMedico.count(), cantidad);
      assert.equal(
        await prisma.turno.count({
          where: {
            id: { in: turnos.map((t) => t.id) },
            estado: { in: ["PENDIENTE", "CONFIRMADO"] },
            requiereReprogramacion: false,
          },
        }),
        3,
      );
      assert.equal(correos.length, correoInicial);
      const borde = await doc.post("/api/bloqueos", {
        data: { ...datos, horaInicio: "09:10", horaFin: "09:30" },
      });
      assert.equal(
        (await borde.json()).conflictos.length,
        2,
        "Las franjas usan solapamiento real, excluyen el turno que empieza al finalizar la licencia",
      );
    },
  );
  await caso(
    "el médico revisa el popup y puede volver sin registrar la licencia",
    async () => {
      const browser = await chromium.launch({ headless: true });
      try {
        const context = await browser.newContext({
          storageState: await doc.storageState(),
          viewport: { width: 1440, height: 1000 },
        });
        const page = await context.newPage();
        await page.goto(baseURL + "/bloqueos");
        assert.equal(
          await page
            .getByText(
              "Tus solicitudes requieren aprobación de secretaría o administración.",
              { exact: true },
            )
            .count(),
          0,
        );
        await page.getByLabel("Tipo de ausencia", { exact: true }).click();
        await page
          .getByLabel("Tipo de ausencia", { exact: true })
          .selectOption("horas");
        await page.getByLabel("Fecha", { exact: true }).fill(fecha);
        await page.getByLabel("Hora de inicio", { exact: true }).fill("09:00");
        await page.getByLabel("Hora de fin", { exact: true }).fill("10:00");
        await page
          .getByRole("button", { name: "Registrar licencia", exact: true })
          .first()
          .click();
        const modal = page.getByRole("dialog");
        await modal.waitFor();
        assert.equal(await modal.locator("li").count(), 3);
        assert((await modal.innerText()).includes("correo"));
        assert((await modal.innerText()).includes("enlace"));
        await modal.screenshot({
          path: "test-results/licencia-conflictos-escritorio.png",
        });
        await page.setViewportSize({ width: 390, height: 844 });
        assert(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        );
        await modal.screenshot({
          path: "test-results/licencia-conflictos-celular.png",
        });
        await modal
          .getByRole("button", { name: "Volver sin registrar", exact: true })
          .click();
        await modal.waitFor({ state: "hidden" });
        assert.equal(
          await prisma.turno.count({
            where: {
              id: { in: turnos.map((t) => t.id) },
              requiereReprogramacion: true,
            },
          }),
          0,
        );
        assert.equal(correos.length, correoInicial);
      } finally {
        await browser.close();
      }
    },
  );
  await caso(
    "la confirmación detecta turnos nuevos y versiones cambiadas antes de registrar la licencia",
    async () => {
      const nuevo = await crear("09:45");
      turnos.push(nuevo);
      const cambiado = await doc.post("/api/bloqueos", {
        data: {
          ...datos,
          confirmarReprogramacion: true,
          turnosConfirmados: conflictos.map((t) => ({
            id: t.id,
            version: t.version,
          })),
        },
      });
      assert.equal(cambiado.status(), 409);
      conflictos = (await cambiado.json()).conflictos;
      assert.equal(conflictos.length, 4);
      await prisma.turno.update({
        where: { id: turnos[0].id },
        data: { version: { increment: 1 } },
      });
      const obsoleto = await doc.post("/api/bloqueos", {
        data: {
          ...datos,
          confirmarReprogramacion: true,
          turnosConfirmados: conflictos.map((t) => ({
            id: t.id,
            version: t.version,
          })),
        },
      });
      assert.equal(obsoleto.status(), 409);
      conflictos = (await obsoleto.json()).conflictos;
      assert.equal(
        await prisma.turno.count({
          where: {
            id: { in: turnos.map((t) => t.id) },
            requiereReprogramacion: true,
          },
        }),
        0,
      );
    },
  );
  await caso(
    "al confirmar se bloquea la licencia, se conservan los turnos para reprogramar y se envían los enlaces automáticamente",
    async () => {
      const browser = await chromium.launch({ headless: true });
      let b: {
        estado: string;
        turnosAfectados: number;
        notificacionesProgramadas: number;
      };
      try {
        const context = await browser.newContext({
          storageState: await doc.storageState(),
        });
        const page = await context.newPage();
        await page.goto(baseURL + "/bloqueos");
        await page.getByLabel("Tipo de ausencia", { exact: true }).click();
        await page
          .getByLabel("Tipo de ausencia", { exact: true })
          .selectOption("horas");
        await page.getByLabel("Fecha", { exact: true }).fill(fecha);
        await page.getByLabel("Hora de inicio", { exact: true }).fill("09:00");
        await page.getByLabel("Hora de fin", { exact: true }).fill("10:00");
        await page
          .getByRole("button", { name: "Registrar licencia", exact: true })
          .first()
          .click();
        const modal = page.getByRole("dialog");
        await modal.waitFor();
        assert.equal(await modal.locator("li").count(), 4);
        const registrada = page.waitForResponse(
          (r) =>
            new URL(r.url()).pathname === "/api/bloqueos" &&
            r.request().method() === "POST" &&
            r.status() === 201,
        );
        await modal
          .getByRole("button", {
            name: "Registrar licencia y avisar",
            exact: true,
          })
          .click();
        b = await (await registrada).json();
        await modal.waitFor({ state: "hidden" });
        await page
          .getByRole("status")
          .filter({ hasText: "Ausencia guardada" })
          .waitFor();
      } finally {
        await browser.close();
      }
      assert.equal(b.estado, "APROBADO");
      assert.equal(b.turnosAfectados, 4);
      assert.equal(b.notificacionesProgramadas, 4);
      assert.equal(
        await prisma.turno.count({
          where: {
            id: { in: turnos.map((t) => t.id) },
            estado: "CANCELADO",
            requiereReprogramacion: true,
          },
        }),
        4,
      );
      assert.equal(
        (await prisma.turno.findUniqueOrThrow({ where: { id: exterior.id } }))
          .estado,
        "PENDIENTE",
      );
      const disponibles = await (
        await anon.get(
          `/api/publico/disponibilidad?medicoId=${medicoId}&fecha=${fecha}`,
        )
      ).json();
      assert(
        !disponibles.slots.some((h: string) => h >= "09:00" && h < "10:00"),
      );
      await esperarAvisos(turnos.map((t) => t.id));
      const enviados = correos
        .slice(correoInicial)
        .filter((c) => c.subject === "Tu turno debe ser reprogramado");
      assert.equal(enviados.length, 4);
      assert(
        enviados.every(
          (c) =>
            c.to.includes(paciente.email!) &&
            c.text.includes("debe ser reprogramado") &&
            c.text.includes("?reprogramar="),
        ),
      );
      assert(
        enviados.every(
          (c) =>
            c.html.includes("&lt;Licencia&gt;") && !c.html.includes("motivo"),
        ),
      );
      await Promise.all([
        procesarAvisosReprogramacion(),
        procesarAvisosReprogramacion(),
      ]);
      assert.equal(
        correos.filter((c) => c.subject === "Tu turno debe ser reprogramado")
          .length,
        4,
        "Los avisos enviados no se duplican en reintentos",
      );
      const publico = await (
        await anon.get(
          `/api/publico/mi-turno/${acceso.token}?turnoId=${turnos[0].id}`,
        )
      ).json();
      assert.equal(publico.turnoDestacado.requiereReprogramacion, true);
      assert(!JSON.stringify(publico).includes("avisoReprogramacionError"));
      const ajeno = await (
        await anon.get(
          `/api/publico/mi-turno/${acceso.token}?turnoId=inexistente`,
        )
      ).json();
      assert.equal(ajeno.turnoDestacado, null);
    },
  );
  await caso(
    "el enlace abre la reprogramación y permite elegir otra fecha incluso para una cita original vencida",
    async () => {
      const t = await prisma.turno.update({
        where: { id: turnos[0].id },
        data: { fecha: fechaDB(sumarDias(fechaClinica(), -1)) },
      });
      const browser = await chromium.launch({ headless: true });
      try {
        const page = await browser.newPage({
          viewport: { width: 390, height: 844 },
        });
        await page.goto(
          `${baseURL}/mi-turno/${acceso.token}?reprogramar=${t.id}`,
        );
        await page.locator(".reprogram-form").waitFor();
        assert(
          (await page.locator(".patient-dashboard").innerText()).includes(
            "debe ser reprogramado",
          ),
        );
      } finally {
        await browser.close();
      }
      const nuevaFecha = sumarDias(fecha, 7);
      const r = await anon.post(
        `/api/publico/mi-turno/${acceso.token}/reprogramar`,
        {
          data: {
            turnoId: t.id,
            version: t.version,
            medicoId,
            fecha: nuevaFecha,
            horaInicio: "09:00",
          },
        },
      );
      assert.equal(r.status(), 200);
      const guardado = await prisma.turno.findUniqueOrThrow({
        where: { id: t.id },
      });
      assert.equal(guardado.requiereReprogramacion, false);
      assert.equal(guardado.estado, "PENDIENTE");
      assert.equal(guardado.fecha.toISOString().slice(0, 10), nuevaFecha);
      assert.equal(
        await prisma.historialTurno.count({
          where: { turnoId: t.id, detalle: { contains: "Reprogramado" } },
        }),
        1,
      );
      assert.equal(
        (await doc.delete(`/api/bloqueos/inexistente`)).status(),
        404,
      );
    },
  );
  await caso(
    "los fallos de correo quedan pendientes para reintentar y los pacientes sin email se identifican",
    async () => {
      const dia = sumarDias(fecha, 14);
      const t = await crearTurno({
        pacienteId: paciente.id,
        medicoId,
        fecha: dia,
        horaInicio: "11:00",
        canalReserva: "ONLINE",
        realizadoPor: "prueba:licencia",
      });
      const previa = await doc.post("/api/bloqueos", {
        data: { ...datos, fecha: dia, horaInicio: "11:00", horaFin: "11:15" },
      });
      const lista = (await previa.json()).conflictos;
      fallarCorreo(true);
      try {
        assert.equal(
          (
            await doc.post("/api/bloqueos", {
              data: {
                ...datos,
                fecha: dia,
                horaInicio: "11:00",
                horaFin: "11:15",
                confirmarReprogramacion: true,
                turnosConfirmados: lista.map((x: ConflictoLicencia) => ({
                  id: x.id,
                  version: x.version,
                })),
              },
            })
          ).status(),
          201,
        );
        const hasta = Date.now() + 10000;
        while (
          Date.now() < hasta &&
          !(await prisma.turno.findUniqueOrThrow({ where: { id: t.id } }))
            .avisoReprogramacionIntentadoEl
        )
          await new Promise((r) => setTimeout(r, 100));
        const pendiente = await prisma.turno.findUniqueOrThrow({
          where: { id: t.id },
        });
        assert.equal(pendiente.avisoReprogramacionEnviado, false);
        assert(pendiente.avisoReprogramacionError);
      } finally {
        fallarCorreo(false);
      }
      await procesarAvisosReprogramacion();
      await esperarAvisos([t.id]);
      const accesoSinEmail = crearTokenAcceso();
      const sinEmail = await prisma.paciente.create({
        data: {
          nombre: "Sin",
          apellido: "Correo",
          dni: "74123451",
          telefono: "1155550303",
          tokenAccesoHash: accesoSinEmail.tokenAccesoHash,
          tokenAccesoEnc: accesoSinEmail.tokenAccesoEnc,
        },
      });
      const s = await crearTurno({
        pacienteId: sinEmail.id,
        medicoId,
        fecha: dia,
        horaInicio: "11:30",
        canalReserva: "ONLINE",
        realizadoPor: "prueba:licencia",
      });
      const p = await doc.post("/api/bloqueos", {
        data: { ...datos, fecha: dia, horaInicio: "11:30", horaFin: "11:45" },
      });
      const listaSinEmail = (await p.json()).conflictos;
      assert.equal(listaSinEmail[0].tieneEmail, false);
      const confirmado = await doc.post("/api/bloqueos", {
        data: {
          ...datos,
          fecha: dia,
          horaInicio: "11:30",
          horaFin: "11:45",
          confirmarReprogramacion: true,
          turnosConfirmados: [{ id: s.id, version: 0 }],
        },
      });
      assert.equal((await confirmado.json()).sinEmail, 1);
      await procesarAvisosReprogramacion();
      assert.equal(
        (await prisma.turno.findUniqueOrThrow({ where: { id: s.id } }))
          .avisoReprogramacionEnviado,
        false,
      );
      assert.equal(
        (await sec.get(`/api/pacientes/${sinEmail.id}`)).status(),
        200,
      );
    },
  );
  await caso(
    "las solicitudes anteriores pueden ser registradas por su médico y siguen protegidas frente a otros médicos",
    async () => {
      const anterior = await prisma.bloqueoMedico.create({
        data: {
          medicoId,
          fecha: fechaDB(sumarDias(fecha, 28)),
          horaInicio: "14:00",
          horaFin: "14:15",
          motivo: "Solicitud anterior",
          estado: "PENDIENTE",
        },
      });
      const ajena = await prisma.bloqueoMedico.create({
        data: {
          medicoId: otroMedico.id,
          fecha: fechaDB(sumarDias(fecha, 28)),
          motivo: "Solicitud ajena",
          estado: "PENDIENTE",
        },
      });
      assert.equal(
        (
          await doc.patch(`/api/bloqueos/${ajena.id}`, {
            data: { estado: "APROBADO" },
          })
        ).status(),
        403,
      );
      assert.equal(
        (await doc.delete(`/api/bloqueos/${ajena.id}`)).status(),
        403,
      );
      const registrada = await doc.patch(`/api/bloqueos/${anterior.id}`, {
        data: { estado: "APROBADO" },
      });
      assert.equal(registrada.status(), 200);
      assert.equal((await registrada.json()).estado, "APROBADO");
      assert.equal(
        (await doc.delete(`/api/bloqueos/${anterior.id}`)).status(),
        200,
      );
      assert.equal(
        (
          await prisma.bloqueoMedico.findUniqueOrThrow({
            where: { id: anterior.id },
          })
        ).estado,
        "RECHAZADO",
      );
    },
  );
}
