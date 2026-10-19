import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium, type APIRequestContext } from "@playwright/test";
import type { PrismaClient } from "../app/generated/prisma/client";
import { sumarDias, fechaDB } from "../lib/fecha";

export async function pruebasPanel({
  prisma,
  sec,
  doc,
  adm,
  anon,
  baseURL,
  futuro,
  medicoId,
  pacienteId,
  autorId,
  caso,
}: {
  prisma: PrismaClient;
  sec: APIRequestContext;
  doc: APIRequestContext;
  adm: APIRequestContext;
  anon: APIRequestContext;
  baseURL: string;
  futuro: string;
  medicoId: string;
  pacienteId: string;
  autorId: string;
  caso: (nombre: string, fn: () => Promise<void>) => Promise<void>;
}) {
  const { crearTokenAcceso } = await import("../lib/pacientes");
  const { crearTurno } = await import("../lib/turnos");
  const especialidad = await prisma.especialidad.findFirstOrThrow();
  const fecha = sumarDias(futuro, 40);
  const medico = await prisma.medico.create({
    data: {
      nombre: "Agenda",
      apellido: "Color",
      especialidadId: especialidad.id,
      duracionTurnoMinutos: 15,
      color: "#526f88",
    },
  });
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
    data: dias.map((diaSemana) => ({
      medicoId: medico.id,
      diaSemana,
      horaInicio: "09:00",
      horaFin: "12:00",
    })),
  });
  const token = crearTokenAcceso();
  const ajeno = await prisma.paciente.create({
    data: {
      dni: "67123450",
      nombre: "Sin",
      apellido: "Relacion",
      tokenAccesoHash: token.tokenAccesoHash,
      tokenAccesoEnc: token.tokenAccesoEnc,
    },
  });
  const base = `/api/pacientes/${pacienteId}`;
  let archivoId = "";
  await caso(
    "las notas compartidas permiten colaboración sin abrir pacientes ajenos ni roles públicos",
    async () => {
      assert.equal((await anon.get(`${base}/notas`)).status(), 401);
      assert.equal(
        (await doc.get(`/api/pacientes/${ajeno.id}/notas`)).status(),
        403,
      );
      assert.equal(
        (
          await doc.post(`/api/pacientes/${ajeno.id}/notas`, {
            data: { contenido: "No autorizado" },
          })
        ).status(),
        403,
      );
      assert.equal(
        (
          await sec.post(`${base}/notas`, {
            data: { contenido: "Documento pendiente de entrega" },
          })
        ).status(),
        201,
      );
      assert.equal(
        (
          await doc.post(`${base}/notas`, {
            data: { contenido: "Estudio recibido por el médico" },
          })
        ).status(),
        201,
      );
      const compartidas = await (await sec.get(`${base}/notas`)).json();
      assert(
        compartidas.some(
          (n: { contenido: string }) =>
            n.contenido === "Estudio recibido por el médico",
        ),
      );
      const delMedico = await (await doc.get(`${base}/notas`)).json();
      assert(
        delMedico.some(
          (n: { contenido: string }) =>
            n.contenido === "Documento pendiente de entrega",
        ),
      );
      assert.equal(
        (
          await sec.post(`${base}/notas`, { data: { contenido: " " } })
        ).status(),
        400,
      );
      assert.equal(
        (await sec.get("/api/pacientes/inexistente/notas")).status(),
        404,
      );
      const seguridad = await prisma.$queryRaw<
        { protegida: boolean; publico: boolean }[]
      >`SELECT c.relrowsecurity AS protegida, has_table_privilege('anon', c.oid, 'SELECT') AS publico FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('NotaPaciente','ArchivoPaciente')`;
      assert.equal(seguridad.length, 2);
      assert(seguridad.every((t) => t.protegida && !t.publico));
    },
  );
  await caso(
    "los archivos persisten, se descargan con sesión y verifican paciente, tamaño y formato",
    async () => {
      const contenido = Buffer.from(
        "%PDF-1.4\nDocumento de prueba local\n%%EOF",
      );
      const multipart = {
        archivo: {
          name: "estudio clínico.pdf",
          mimeType: "application/pdf",
          buffer: contenido,
        },
      };
      assert.equal(
        (await anon.post(`${base}/archivos`, { multipart })).status(),
        401,
      );
      assert.equal(
        (
          await doc.post(`/api/pacientes/${ajeno.id}/archivos`, { multipart })
        ).status(),
        403,
      );
      const guardado = await sec.post(`${base}/archivos`, { multipart });
      assert.equal(guardado.status(), 201);
      const metadata = await guardado.json();
      archivoId = metadata.id;
      assert.equal(metadata.nombre, "estudio clínico.pdf");
      assert(!("contenido" in metadata));
      const persistido = await prisma.archivoPaciente.findUniqueOrThrow({
        where: { id: archivoId },
      });
      assert(Buffer.from(persistido.contenido).equals(contenido));
      const url = `${base}/archivos/${archivoId}`;
      const descarga = await doc.get(url);
      assert.equal(descarga.status(), 200);
      assert((await descarga.body()).equals(contenido));
      assert.match(descarga.headers()["content-disposition"], /^attachment;/);
      assert.match(descarga.headers()["cache-control"], /no-store/);
      assert.equal(descarga.headers()["x-content-type-options"], "nosniff");
      assert.equal((await anon.get(url)).status(), 401);
      assert.equal(
        (
          await sec.get(`/api/pacientes/${ajeno.id}/archivos/${archivoId}`)
        ).status(),
        404,
      );
      assert.equal(
        (
          await doc.get(`/api/pacientes/${ajeno.id}/archivos/${archivoId}`)
        ).status(),
        403,
      );
      assert.equal(
        (
          await sec.post(`${base}/archivos`, {
            multipart: {
              archivo: {
                name: "falso.png",
                mimeType: "image/png",
                buffer: contenido,
              },
            },
          })
        ).status(),
        400,
      );
      assert.equal(
        (
          await sec.post(`${base}/archivos`, {
            multipart: {
              archivo: {
                name: "ejecutable.exe",
                mimeType: "application/octet-stream",
                buffer: contenido,
              },
            },
          })
        ).status(),
        400,
      );
      assert.equal(
        (
          await sec.post(`${base}/archivos`, {
            multipart: {
              archivo: {
                name: "grande.pdf",
                mimeType: "application/pdf",
                buffer: Buffer.alloc(3 * 1024 * 1024 + 1),
              },
            },
          })
        ).status(),
        413,
      );
      const lista = await (await sec.get(`${base}/archivos`)).json();
      assert(lista.some((a: { id: string }) => a.id === archivoId));
      assert(!JSON.stringify(lista).includes("contenido"));
    },
  );
  await caso(
    "el historial de notas se pagina sin perder entradas y los archivos siguen disponibles",
    async () => {
      await prisma.notaPaciente.createMany({
        data: Array.from({ length: 27 }, (_, i) => ({
          pacienteId,
          autorId,
          contenido: `Nota de archivo ${i}`,
        })),
      });
      const primera = await (await sec.get(`${base}/notas?pagina=1`)).json();
      const segunda = await (await sec.get(`${base}/notas?pagina=2`)).json();
      assert.equal(primera.length, 25);
      assert.equal(segunda.length, 4);
      assert.equal(new Set([...primera, ...segunda].map((n) => n.id)).size, 29);
      assert.equal(
        (await doc.get(`${base}/archivos/${archivoId}`)).status(),
        200,
      );
    },
  );
  const nuevo = {
    dni: "67123451",
    nombre: "Nuevo",
    apellido: "Paciente Calendario",
    telefono: "+54 9 11 5555 0101",
    email: "nuevo-panel@example.test",
  };
  const datosTurno = {
    medicoId: medico.id,
    fecha,
    horaInicio: "09:00",
    motivoConsulta: "Alta con turno",
  };
  let nuevoId = "";
  await caso(
    "secretaría guarda paciente y turno juntos; los conflictos no dejan altas incompletas",
    async () => {
      const res = await sec.post("/api/turnos", {
        data: { ...datosTurno, pacienteNuevo: nuevo },
      });
      assert.equal(res.status(), 201);
      const turno = await res.json();
      nuevoId = turno.pacienteId;
      assert.equal(turno.estado, "CONFIRMADO");
      assert.equal(turno.canalReserva, "PRESENCIAL");
      assert(!JSON.stringify(turno).includes("tokenAcceso"));
      assert.equal(
        (await prisma.paciente.findUniqueOrThrow({ where: { id: nuevoId } }))
          .dni,
        nuevo.dni,
      );
      assert.equal(
        (
          await sec.post("/api/turnos", {
            data: { ...datosTurno, horaInicio: "09:15", pacienteNuevo: nuevo },
          })
        ).status(),
        409,
      );
      assert.equal(
        (
          await sec.post("/api/turnos", {
            data: {
              ...datosTurno,
              pacienteNuevo: { ...nuevo, dni: "67123452" },
            },
          })
        ).status(),
        409,
      );
      assert.equal(
        await prisma.paciente.count({ where: { dni: "67123452" } }),
        0,
      );
      assert.equal(
        (
          await sec.post("/api/turnos", {
            data: { ...datosTurno, pacienteId: nuevoId, pacienteNuevo: nuevo },
          })
        ).status(),
        400,
      );
      assert.equal(
        (
          await doc.post("/api/turnos", {
            data: {
              ...datosTurno,
              pacienteNuevo: { ...nuevo, dni: "67123453" },
            },
          })
        ).status(),
        403,
      );
    },
  );
  await caso(
    "cada médico tiene un color configurable y el calendario mantiene estado, versión y teléfono",
    async () => {
      const data = {
        nombre: medico.nombre,
        apellido: medico.apellido,
        especialidadId: especialidad.id,
        duracionTurnoMinutos: 15,
        activo: true,
        color: "#658b70",
      };
      assert.equal(
        (await sec.patch(`/api/medicos/${medico.id}`, { data })).status(),
        200,
      );
      assert.equal(
        (
          await sec.patch(`/api/medicos/${medico.id}`, {
            data: { ...data, color: "color-invalido" },
          })
        ).status(),
        400,
      );
      const nuevoMedico = await sec.post("/api/medicos", {
        data: { ...data, nombre: "Segundo", color: undefined },
      });
      assert.equal(nuevoMedico.status(), 201);
      assert.notEqual((await nuevoMedico.json()).color, "#658b70");
      const listado = await (
        await sec.get(`/api/turnos/calendario?desde=${fecha}&hasta=${fecha}`)
      ).json();
      const turno = listado.find((t: { pacienteNombre: string }) =>
        t.pacienteNombre.includes("Paciente Calendario"),
      );
      assert.equal(turno.medicoColor, "#658b70");
      assert.equal(turno.version, 0);
      assert.equal(turno.pacienteTelefono, nuevo.telefono);
    },
  );
  const pendiente = await crearTurno({
    pacienteId: nuevoId,
    medicoId: medico.id,
    fecha,
    horaInicio: "09:15",
    canalReserva: "ONLINE",
    realizadoPor: "prueba:online",
  });
  const aCancelar = await crearTurno({
    pacienteId: nuevoId,
    medicoId: medico.id,
    fecha,
    horaInicio: "09:30",
    canalReserva: "ONLINE",
    realizadoPor: "prueba:online",
  });
  await caso(
    "el calendario confirma el turno gris, aplica el color y muestra el teléfono al cancelar",
    async () => {
      assert.equal(pendiente.estado, "PENDIENTE");
      const browser = await chromium.launch({ headless: true });
      try {
        const context = await browser.newContext({
          storageState: await sec.storageState(),
          viewport: { width: 1440, height: 1000 },
        });
        const page = await context.newPage();
        await page.goto(`${baseURL}/panel`);
        assert.equal(await page.locator(".metric-card").count(), 1);
        assert(
          (await page.locator(".metric-card").innerText()).includes(
            "Turnos de hoy",
          ),
        );
        await page
          .getByRole("button", { name: "Volver atrás", exact: true })
          .waitFor({ state: "visible" });
        assert(
          await page.evaluate(
            () => parseFloat(getComputedStyle(document.body).fontSize) === 16,
          ),
        );
        const metric = await page.locator(".metric-card").boundingBox();
        const accesos = await page.locator(".quick-access").boundingBox();
        const agenda = await page
          .locator(".dashboard-columns > .surface")
          .boundingBox();
        assert(metric && accesos && agenda);
        assert(Math.abs(metric.width - accesos.width) < 1);
        assert(Math.abs(metric.x - accesos.x) < 1);
        assert(metric.y + metric.height < accesos.y);
        assert(accesos.width > 300 && agenda.width > accesos.width);
        assert(Math.abs(metric.y - agenda.y) < 1);
        const mainBefore = await page.locator(".staff-main").boundingBox();
        assert.equal(
          await page.locator(".sidebar").getAttribute("aria-hidden"),
          "true",
        );
        await page.mouse.move(2, 400);
        await page.waitForFunction(
          () =>
            document.querySelector(".sidebar")?.getAttribute("aria-hidden") ===
            "false",
        );
        assert.deepEqual(
          await page.locator(".staff-main").boundingBox(),
          mainBefore,
        );
        await page.mouse.move(600, 400);
        await page.waitForFunction(
          () =>
            document.querySelector(".sidebar")?.getAttribute("aria-hidden") ===
            "true",
        );
        await page.screenshot({
          path: "test-results/inicio-ajustes.png",
          fullPage: true,
        });
        await page.goto(`${baseURL}/turnos`);
        await page.getByLabel("Fecha", { exact: true }).fill(fecha);
        await page.getByLabel("Vista", { exact: true }).selectOption("semana");
        const tarjeta = page.locator(
          `.calendar-desktop [data-turno-id="${pendiente.id}"]`,
        );
        await tarjeta.waitFor();
        assert.equal(
          await tarjeta.evaluate((el) => getComputedStyle(el).backgroundColor),
          "rgb(236, 239, 242)",
        );
        let recargas = 0;
        page.on("request", (request) => {
          const url = new URL(request.url());
          if (
            url.pathname === "/turnos" &&
            (request.isNavigationRequest() || request.headers()["rsc"] === "1")
          )
            recargas++;
        });
        // Demorar la actualización de datos comprueba que la agenda anterior
        // permanece montada mientras llegan los cambios, sin pantalla de carga.
        await page.route("**/api/turnos/calendario?**", async (route) => {
          await new Promise((resolve) => setTimeout(resolve, 250));
          await route.continue();
        });
        await tarjeta.evaluate((el) =>
          el.setAttribute("data-conservado", "si"),
        );
        await tarjeta
          .getByRole("button", { name: /^Confirmar turno de/ })
          .click();
        await page
          .locator(
            `.calendar-desktop [data-turno-id="${pendiente.id}"][data-estado="CONFIRMADO"]`,
          )
          .waitFor();
        assert.equal(await tarjeta.locator(".event-actions").count(), 0);
        assert.equal(await tarjeta.getAttribute("data-conservado"), "si");
        assert.equal(
          await page.getByLabel("Vista", { exact: true }).inputValue(),
          "semana",
        );
        assert.equal(
          await page.getByLabel("Fecha", { exact: true }).inputValue(),
          fecha,
        );
        await page
          .locator(`a[href="/turnos/${pendiente.id}"]`)
          .getByText("Confirmado", { exact: true })
          .waitFor();
        assert.notEqual(
          await tarjeta.evaluate((el) => getComputedStyle(el).backgroundColor),
          "rgb(236, 239, 242)",
        );
        const cancelar = page.locator(
          `.calendar-desktop [data-turno-id="${aCancelar.id}"]`,
        );
        await cancelar
          .getByRole("button", { name: /^Cancelar turno de/ })
          .click();
        const aviso = page.locator(".recent-cancellation");
        await aviso.waitFor();
        await page
          .locator(`a[href="/turnos/${aCancelar.id}"]`)
          .getByText("Cancelado", { exact: true })
          .waitFor();
        assert((await aviso.innerText()).includes(nuevo.telefono));
        assert.equal(
          recargas,
          0,
          "Confirmar y cancelar usan actualizaciones locales, sin pedir de nuevo la página",
        );
        assert.equal((await anon.get("/api/turnos/recientes")).status(), 401);
        assert.equal((await doc.get("/api/turnos/recientes")).status(), 403);
        assert.equal(
          await aviso
            .getByRole("link", { name: nuevo.telefono, exact: true })
            .getAttribute("href"),
          "tel:+5491155550101",
        );
        await mkdir("test-results", { recursive: true });
        await page.screenshot({
          path: "test-results/calendario-confirmacion-colores.png",
          fullPage: true,
        });
        const confirmado = await prisma.turno.findUniqueOrThrow({
          where: { id: pendiente.id },
        });
        assert.equal(confirmado.estado, "CONFIRMADO");
        assert.equal(
          (
            await sec.patch(`/api/turnos/${pendiente.id}`, {
              data: { estado: "CANCELADO", version: 0 },
            })
          ).status(),
          409,
        );
        await page.setViewportSize({ width: 390, height: 844 });
        assert(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        );
        await page.screenshot({
          path: "test-results/calendario-colores-celular.png",
          fullPage: true,
        });
      } finally {
        await browser.close();
      }
    },
  );
  await caso(
    "vacaciones y ausencias por horas bloquean reservas y el período es atómico",
    async () => {
      const fechaVacaciones = sumarDias(fecha, 3);
      const vacaciones = await sec.post("/api/bloqueos", {
        data: {
          medicoId: medico.id,
          fecha: fechaVacaciones,
          fechaHasta: sumarDias(fecha, 5),
          motivo: "Vacaciones de prueba",
        },
      });
      assert.equal(vacaciones.status(), 201);
      assert.equal((await vacaciones.json()).cantidad, 3);
      const disponibles = await (
        await sec.get(
          `/api/disponibilidad?medicoId=${medico.id}&fecha=${fechaVacaciones}`,
        )
      ).json();
      assert.equal(disponibles.slots.length, 0);
      await assert.rejects(
        crearTurno({
          pacienteId: nuevoId,
          medicoId: medico.id,
          fecha: fechaVacaciones,
          horaInicio: "09:00",
          canalReserva: "ONLINE",
          realizadoPor: "prueba:online",
        }),
      );
      const cantidad = await prisma.bloqueoMedico.count({
        where: { medicoId: medico.id },
      });
      assert.equal(
        (
          await sec.post("/api/bloqueos", {
            data: {
              medicoId: medico.id,
              fecha,
              fechaHasta: sumarDias(fecha, 2),
              motivo: "Con conflicto",
            },
          })
        ).status(),
        409,
      );
      assert.equal(
        await prisma.bloqueoMedico.count({ where: { medicoId: medico.id } }),
        cantidad,
      );
      const fechaHoras = sumarDias(fecha, 8);
      const parcial = await sec.post("/api/bloqueos", {
        data: {
          medicoId: medico.id,
          fecha: fechaHoras,
          horaInicio: "09:00",
          horaFin: "10:00",
          motivo: "Llega más tarde",
        },
      });
      assert.equal(parcial.status(), 201);
      const bloqueo = await parcial.json();
      const horas = await (
        await sec.get(
          `/api/disponibilidad?medicoId=${medico.id}&fecha=${fechaHoras}`,
        )
      ).json();
      assert(!horas.slots.includes("09:15"));
      assert(horas.slots.includes("10:00"));
      assert.equal(
        (await doc.delete(`/api/bloqueos/${bloqueo.id}`)).status(),
        403,
      );
      assert.equal(
        (await sec.delete(`/api/bloqueos/${bloqueo.id}`)).status(),
        200,
      );
      assert(
        (
          await (
            await sec.get(
              `/api/disponibilidad?medicoId=${medico.id}&fecha=${fechaHoras}`,
            )
          ).json()
        ).slots.includes("09:15"),
      );
      assert.equal(
        (
          await sec.post("/api/bloqueos", {
            data: {
              medicoId: medico.id,
              fecha: fechaHoras,
              fechaHasta: fecha,
              motivo: "Fecha inválida",
            },
          })
        ).status(),
        400,
      );
    },
  );
  await caso(
    "secretaría usa la ficha compartida, el alta con turno y las vacaciones desde las pantallas",
    async () => {
      const browser = await chromium.launch({ headless: true });
      try {
        const context = await browser.newContext({
          storageState: await sec.storageState(),
          viewport: { width: 1440, height: 1000 },
        });
        const page = await context.newPage();
        await page.goto(`${baseURL}/pacientes/${pacienteId}`);
        await page
          .getByRole("heading", {
            name: "Todos los turnos del paciente",
            exact: true,
          })
          .waitFor();
        await page
          .getByLabel("Nueva nota", { exact: true })
          .fill("Nota compartida desde la ficha");
        await page
          .getByRole("button", { name: "Guardar nota", exact: true })
          .click();
        await page
          .getByText("Nota compartida desde la ficha", { exact: true })
          .waitFor();
        await page
          .getByLabel("Agregar archivo", { exact: true })
          .setInputFiles({
            name: "constancia.txt",
            mimeType: "text/plain",
            buffer: Buffer.from("Constancia persistida desde el panel"),
          });
        await page
          .getByRole("button", { name: "Guardar archivo", exact: true })
          .click();
        await page.getByText("constancia.txt", { exact: true }).waitFor();
        await page.reload();
        await page.getByText("constancia.txt", { exact: true }).waitFor();
        await page.screenshot({
          path: "test-results/paciente-historial-notas-archivos.png",
          fullPage: true,
        });
        await page.goto(
          `${baseURL}/turnos/nuevo?medicoId=${medico.id}&fecha=${fecha}`,
        );
        await page
          .getByRole("button", { name: "Crear paciente nuevo", exact: true })
          .click();
        await page.getByLabel("DNI *", { exact: true }).fill("67123459");
        await page.getByLabel("Nombre *", { exact: true }).fill("Paciente");
        await page.getByLabel("Apellido *", { exact: true }).fill("Pantalla");
        await page
          .locator('#turno-form-campo-3 option[value="11:00"]')
          .waitFor({ state: "attached" });
        await page
          .getByLabel("Horario *", { exact: true })
          .selectOption("11:00");
        await page
          .getByRole("button", { name: "Reservar turno", exact: true })
          .click();
        await page.waitForURL("**/turnos");
        const p = await prisma.paciente.findUniqueOrThrow({
          where: { dni: "67123459" },
        });
        assert.equal(
          await prisma.turno.count({
            where: { pacienteId: p.id, estado: "CONFIRMADO" },
          }),
          1,
        );
        await page.goto(`${baseURL}/medicos/${medico.id}`);
        const ausencias = page
          .getByRole("heading", {
            name: "Vacaciones y tiempos libres",
            exact: true,
          })
          .locator("..");
        await ausencias
          .getByLabel("Tipo de ausencia", { exact: true })
          .selectOption("vacaciones");
        await ausencias
          .getByLabel("Fecha", { exact: true })
          .fill(sumarDias(fecha, 12));
        await ausencias
          .getByLabel("Último día de vacaciones", { exact: true })
          .fill(sumarDias(fecha, 13));
        await ausencias
          .getByRole("button", { name: "Registrar licencia", exact: true })
          .click();
        await ausencias
          .getByRole("status")
          .filter({ hasText: "Ausencia guardada" })
          .waitFor();
        await ausencias.screenshot({
          path: "test-results/medico-vacaciones.png",
        });
        assert.equal(
          await prisma.bloqueoMedico.count({
            where: {
              medicoId: medico.id,
              fecha: {
                gte: fechaDB(sumarDias(fecha, 12)),
                lte: fechaDB(sumarDias(fecha, 13)),
              },
              estado: "APROBADO",
            },
          }),
          2,
        );
        const doctorContext = await browser.newContext({
          storageState: await doc.storageState(),
        });
        const doctorPage = await doctorContext.newPage();
        await doctorPage.goto(`${baseURL}/pacientes/${pacienteId}`);
        await doctorPage.getByText("constancia.txt", { exact: true }).waitFor();
        assert.equal(
          await doctorPage
            .getByRole("button", { name: "Guardar", exact: true })
            .count(),
          0,
        );
        assert.equal(
          (await adm.get(`${base}/archivos/${archivoId}`)).status(),
          200,
        );
        assert.equal(
          (await doc.get(`/api/pacientes/${ajeno.id}/archivos`)).status(),
          403,
        );
        assert.equal(
          (await prisma.turno.count({
            where: { medicoId, pacienteId, estado: { not: "CANCELADO" } },
          })) > 0,
          true,
        );
      } finally {
        await browser.close();
      }
    },
  );
}
