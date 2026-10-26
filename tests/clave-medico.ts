import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { chromium, type APIRequestContext } from "@playwright/test";
import type { PrismaClient } from "../app/generated/prisma/client";
import { generarToken, hashToken } from "../lib/token";

export async function pruebasClaveMedico({
  prisma,
  sec,
  adm,
  doc,
  anon,
  baseURL,
  cliente,
  caso,
}: {
  prisma: PrismaClient;
  sec: APIRequestContext;
  adm: APIRequestContext;
  doc: APIRequestContext;
  anon: APIRequestContext;
  baseURL: string;
  cliente: (email?: string, clave?: string) => Promise<APIRequestContext>;
  caso: (nombre: string, fn: () => Promise<void>) => Promise<void>;
}) {
  const especialidad = await prisma.especialidad.findFirstOrThrow();
  const medico = await prisma.medico.create({
    data: {
      nombre: "Cambio",
      apellido: "Contraseña",
      especialidadId: especialidad.id,
    },
  });
  const original = "Clave-Anterior-Medico-2026!";
  const cuenta = await prisma.usuarioInterno.create({
    data: {
      nombre: "Cambio Contraseña",
      email: "cambio-clave-medico@example.test",
      password: await bcrypt.hash(original, 10),
      rol: "MEDICO",
      medicoId: medico.id,
      permisos: JSON.stringify(["agenda", "bloqueos"]),
    },
  });
  const url = `/api/medicos/${medico.id}/acceso`;
  const secretaria = await prisma.usuarioInterno.findUniqueOrThrow({
    where: { email: "secretaria@example.test" },
  });
  await caso(
    "secretaría cambia solo contraseñas médicas con permiso, revoca sesiones y enlaces y evita cambios simultáneos",
    async () => {
      const password = "Clave-Nueva-Medico-2026!";
      const data = { password, confirmacion: password, versionSesion: 0 };
      const previa = await cliente(cuenta.email, original);
      assert.equal((await anon.patch(url, { data })).status(), 401);
      assert.equal((await doc.patch(url, { data })).status(), 403);
      await prisma.usuarioInterno.update({
        where: { id: secretaria.id },
        data: { permisos: JSON.stringify(["turnos"]) },
      });
      try {
        assert.equal((await sec.patch(url, { data })).status(), 403);
      } finally {
        await prisma.usuarioInterno.update({
          where: { id: secretaria.id },
          data: { permisos: secretaria.permisos },
        });
      }
      await prisma.usuarioInterno.update({
        where: { id: secretaria.id },
        data: { activo: false },
      });
      try {
        assert.equal((await sec.patch(url, { data })).status(), 401);
      } finally {
        await prisma.usuarioInterno.update({
          where: { id: secretaria.id },
          data: { activo: true },
        });
      }
      for (const invalido of [
        { ...data, password: "corta", confirmacion: "corta" },
        { ...data, password: "ñ".repeat(37), confirmacion: "ñ".repeat(37) },
        { ...data, confirmacion: "Diferente-2026!" },
        { ...data, rol: "ADMIN" },
        { ...data, activo: true },
        { ...data, email: "otro@example.test" },
        { password, confirmacion: password },
      ])
        assert.equal((await sec.patch(url, { data: invalido })).status(), 400);
      assert.equal(
        (await sec.patch("/api/medicos/no-existe/acceso", { data })).status(),
        404,
      );
      const token = generarToken();
      await prisma.recuperacionCuenta.create({
        data: {
          usuarioId: cuenta.id,
          versionSesion: 0,
          tokenHash: hashToken(token),
          venceEl: new Date(Date.now() + 60000),
        },
      });
      const resultados = await Promise.all([
        sec.patch(url, { data }),
        sec.patch(url, { data }),
      ]);
      assert.deepEqual(resultados.map((r) => r.status()).sort(), [200, 409]);
      const exito = resultados.find((r) => r.status() === 200)!;
      assert.match(exito.headers()["cache-control"], /no-store/);
      assert.deepEqual(await exito.json(), {
        usuario: { email: cuenta.email, activo: true, versionSesion: 1 },
      });
      const actual = await prisma.usuarioInterno.findUniqueOrThrow({
        where: { id: cuenta.id },
      });
      assert(await bcrypt.compare(password, actual.password));
      assert.notEqual(actual.password, password);
      assert.equal(actual.rol, cuenta.rol);
      assert.equal(actual.permisos, cuenta.permisos);
      assert.equal(actual.medicoId, cuenta.medicoId);
      assert.equal(actual.email, cuenta.email);
      assert.equal((await previa.get("/api/bloqueos")).status(), 401);
      await assert.rejects(() => cliente(cuenta.email, original));
      const vigente = await cliente(cuenta.email, password);
      assert.equal((await vigente.get("/api/bloqueos")).status(), 200);
      assert.equal(
        (
          await anon.post("/api/cuenta/restablecer", {
            data: { token, nueva: original, confirmacion: original },
          })
        ).status(),
        400,
      );
      assert.equal((await sec.patch(url, { data })).status(), 409);
      await prisma.usuarioInterno.update({
        where: { id: cuenta.id },
        data: { activo: false },
      });
      const admin = await adm.patch(url, {
        data: { ...data, versionSesion: 1 },
      });
      assert.equal(admin.status(), 200);
      assert.equal((await admin.json()).usuario.activo, false);
      await prisma.usuarioInterno.update({
        where: { id: cuenta.id },
        data: { rol: "ADMIN", activo: true },
      });
      try {
        assert.equal(
          (
            await sec.patch(url, { data: { ...data, versionSesion: 2 } })
          ).status(),
          403,
        );
      } finally {
        await prisma.usuarioInterno.update({
          where: { id: cuenta.id },
          data: { rol: "MEDICO", activo: false },
        });
      }
    },
  );
  await caso(
    "secretaría elige y confirma una nueva contraseña desde el perfil móvil, puede cancelar y la clave no reaparece al recargar",
    async () => {
      await prisma.usuarioInterno.update({
        where: { id: cuenta.id },
        data: { activo: true },
      });
      const browser = await chromium.launch();
      try {
        const context = await browser.newContext({
          storageState: await sec.storageState(),
          viewport: { width: 390, height: 844 },
        });
        const page = await context.newPage();
        await page.goto(`${baseURL}/medicos/${medico.id}`);
        const seccion = page.locator(
          'section[aria-labelledby="acceso-medico-titulo"]',
        );
        await seccion
          .getByRole("button", { name: "Cambiar contraseña", exact: true })
          .click();
        const clave = seccion.getByLabel("Nueva contraseña *", { exact: true });
        const confirmar = seccion.getByLabel("Confirmar contraseña *", {
          exact: true,
        });
        await clave.fill("No-guardar-2026!");
        await confirmar.fill("No-guardar-2026!");
        await seccion
          .getByRole("button", { name: "Cancelar", exact: true })
          .click();
        await seccion
          .getByRole("button", { name: "Cambiar contraseña", exact: true })
          .click();
        assert.equal(await clave.inputValue(), "");
        assert.equal(await confirmar.inputValue(), "");
        assert.equal(await clave.getAttribute("type"), "password");
        const nueva = "Elegida-en-panel-2026!";
        await clave.fill(nueva);
        await confirmar.fill("Otra-contraseña-2026!");
        await seccion
          .getByRole("button", { name: "Guardar contraseña", exact: true })
          .click();
        await seccion
          .getByRole("alert")
          .filter({ hasText: "Las contraseñas no coinciden." })
          .waitFor();
        await confirmar.fill(nueva);
        const respuesta = page.waitForResponse(
          (r) => r.url().endsWith(url) && r.request().method() === "PATCH",
        );
        await seccion
          .getByRole("button", { name: "Guardar contraseña", exact: true })
          .click();
        assert.equal((await respuesta).status(), 200);
        await seccion
          .getByText("Contraseña actualizada para Cambio Contraseña.", {
            exact: true,
          })
          .waitFor();
        assert.equal(await seccion.locator("dd.font-mono").innerText(), nueva);
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
        await cliente(cuenta.email, nueva);
        assert(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        );
        await seccion.screenshot({
          path: "test-results/medico-cambio-clave.png",
        });
        await seccion
          .getByRole("button", { name: "Listo", exact: true })
          .click();
        await seccion
          .getByRole("button", { name: "Cambiar contraseña", exact: true })
          .waitFor();
        await page.reload();
        assert(!(await page.locator("body").innerText()).includes(nueva));
      } finally {
        await browser.close();
      }
    },
  );
}
