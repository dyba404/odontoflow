import { test } from "node:test";
import assert from "node:assert/strict";
import { fechaEn, parseWallClock, clinicNow } from "./dates.js";

test("fechaEn devuelve la fecha en la TZ de la clínica", () => {
  // 19:37 UTC = 14:37 Lima (mismo día)
  const instante = new Date("2026-08-19T18:37:00Z");
  assert.equal(fechaEn(instante, "America/Lima"), "2026-08-19");
});

test("parseWallClock acepta Date y strings ISO", () => {
  const d = new Date("2026-08-20T10:00:00Z");
  assert.equal(parseWallClock(d), d);
  const conHora = parseWallClock("2026-08-20 10:15");
  assert.ok(conHora instanceof Date);
  assert.ok(!Number.isNaN(conHora.getTime()));
});

test("clinicNow devuelve un Date válido", () => {
  assert.ok(clinicNow() instanceof Date);
});
