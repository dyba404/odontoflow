import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hashIp,
  hashValor2fa,
  normalizarValor2fa,
  compararHash2fa,
  firmarCookiePresupuesto,
  verificarCookiePresupuesto,
  nombreCookiePresupuesto,
} from "./budget-link";

test("hashIp es determinista y nunca guarda la IP cruda", () => {
  const a = hashIp("203.0.113.7");
  const b = hashIp("203.0.113.7");
  assert.equal(a, b);
  assert.equal(a.length, 64);
  assert.ok(!a.includes("203.0.113.7"));
  assert.notEqual(hashIp("203.0.113.7"), hashIp("203.0.113.8"));
});

test("normalizarValor2fa: phone_last4 extrae solo dígitos", () => {
  assert.equal(normalizarValor2fa("phone_last4", " 987-654-321 "), "987654321");
  assert.equal(normalizarValor2fa("dob", " 1990-01-31 "), "1990-01-31");
});

test("hashValor2fa + compararHash2fa: round-trip y tiempo constante", () => {
  const h = hashValor2fa("phone_last4", "1234");
  assert.ok(compararHash2fa(h, hashValor2fa("phone_last4", "1234")));
  assert.ok(!compararHash2fa(h, hashValor2fa("phone_last4", "9999")));
  assert.ok(!compararHash2fa(h, "no-es-hex"));
});

test("cookie firmada: verifica solo el token correcto", () => {
  const token = "a".repeat(64);
  const valor = firmarCookiePresupuesto(token);
  assert.ok(verificarCookiePresupuesto(token, valor));
  assert.ok(!verificarCookiePresupuesto(token, undefined));
  assert.ok(!verificarCookiePresupuesto(token, "garbage"));
  assert.ok(!verificarCookiePresupuesto("b".repeat(64), valor));
  const tampered = valor.slice(0, -2) + "00";
  assert.ok(!verificarCookiePresupuesto(token, tampered));
});

test("nombreCookiePresupuesto usa prefijo del token", () => {
  const token = "abcdef1234567890" + "x".repeat(48);
  assert.equal(nombreCookiePresupuesto(token), "ofp2f-abcdef1234567890");
});
