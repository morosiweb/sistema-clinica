import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fechaClinica,
  fechaValida,
  instanteClinica,
  rangoInstantes,
  sumarDias,
} from "../lib/fecha";
import { dniSchema, emailSchema, paginaSchema } from "../lib/validations/comun";
import { permisosPorRol, puedeVer } from "../lib/pantallas";
import { turnoParaInterno, turnoPublicoSelect } from "../lib/turno-dto";
import { pagoSchema } from "../lib/validations/pago";
import {
  generarToken,
  hashToken,
  encriptarToken,
  desencriptarToken,
} from "../lib/token";

test("la agenda interpreta las 14:00 de Buenos Aires como 17:00 UTC", () => {
  assert.equal(
    instanteClinica("2026-10-16", "14:00").toISOString(),
    "2026-10-16T17:00:00.000Z",
  );
  assert.equal(
    (instanteClinica("2026-10-16", "14:00").getTime() -
      Date.parse("2026-10-16T12:00:00Z")) /
      3600000,
    5,
  );
});
test("el día local no cambia a medianoche UTC", () => {
  assert.equal(fechaClinica(new Date("2026-10-17T01:00:00Z")), "2026-10-16");
});
test("los cierres de caja abarcan el día civil completo", () => {
  const r = rangoInstantes("2026-10-16", "2026-10-16");
  assert.equal(r.gte.toISOString(), "2026-10-16T03:00:00.000Z");
  assert.equal(r.lt.toISOString(), "2026-10-17T03:00:00.000Z");
});
test("se rechazan fechas imposibles y se conservan años bisiestos", () => {
  assert(!fechaValida("2099-02-31"));
  assert(fechaValida("2028-02-29"));
  assert(!fechaValida("2027-02-29"));
  assert.equal(sumarDias("2026-12-31", 1), "2027-01-01");
});
test("los DNI y emails tienen representación única", () => {
  assert.equal(dniSchema.parse("12.345.678"), "12345678");
  assert(!dniSchema.safeParse("abcdefg").success);
  assert.equal(emailSchema.parse(" Admin@Example.test "), "admin@example.test");
  assert(!paginaSchema.safeParse("1.5").success);
});
test("un médico nunca hereda permisos de cobro o administración", () => {
  assert(!puedeVer(null, "MEDICO", ["turnos", "medicos", "usuarios"]));
  assert(puedeVer(null, "MEDICO", ["agenda"]));
  assert(!puedeVer(["usuarios"], "SECRETARIA", ["usuarios"]));
  assert(permisosPorRol("SECRETARIA").includes("bloqueos"));
});
test("la serialización de turnos respeta notas clínicas", () => {
  const turno = { medicoId: "m1", notasMedico: "privada" };
  assert.equal(
    turnoParaInterno(turno, { rol: "SECRETARIA", medicoId: null }).notasMedico,
    null,
  );
  assert.equal(
    turnoParaInterno(turno, { rol: "MEDICO", medicoId: "m2" }).notasMedico,
    null,
  );
  assert.equal(
    turnoParaInterno(turno, { rol: "MEDICO", medicoId: "m1" }).notasMedico,
    "privada",
  );
  assert(!("notasMedico" in turnoPublicoSelect));
  assert(!("notasSecretaria" in turnoPublicoSelect));
});
test("los cobros respetan centavos y el límite de la base", () => {
  assert(pagoSchema.safeParse({ monto: 123.45, metodo: "EFECTIVO" }).success);
  assert(!pagoSchema.safeParse({ monto: 0.001, metodo: "EFECTIVO" }).success);
  assert(
    !pagoSchema.safeParse({ monto: 100000000, metodo: "EFECTIVO" }).success,
  );
});
test("los enlaces tienen entropía y autenticación del cifrado", () => {
  process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString("base64");
  const token = generarToken();
  assert.equal(token.length, 43);
  assert.equal(hashToken(token).length, 64);
  const enc = encriptarToken(token);
  assert.equal(desencriptarToken(enc), token);
  const corrupto = Buffer.from(enc, "base64");
  corrupto[20] ^= 1;
  assert.throws(() => desencriptarToken(corrupto.toString("base64")));
});
