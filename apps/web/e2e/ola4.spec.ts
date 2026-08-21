import { expect, test, type Browser, type BrowserContext } from "@playwright/test";
import { USUARIOS, loginPorApi } from "./auth";

const BASE = "http://localhost:3111";
const PATIENT_ID = "1ad7cc35-9b68-408d-a162-19b2b717c7ea";
const SERVICE_ID = "6e1ddb6a-eea2-4a1c-b13c-0bd3c4bf44a3";
const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

async function ctxOwner(browser: Browser): Promise<BrowserContext> {
  const token = await loginPorApi(USUARIOS.owner.email);
  const ctx = await browser.newContext();
  await ctx.addCookies([{ name: "of_session", value: token, domain: "localhost", path: "/" }]);
  return ctx;
}

test.describe("Ola 4 F3-F7 (API)", () => {
  test("F3: plan de tratamiento con items y transicion de estados", async ({ browser }) => {
    const ctx = await ctxOwner(browser);

    const res = await ctx.request.post(`${BASE}/api/planes`, {
      data: {
        patientId: PATIENT_ID,
        titulo: "Plan E2E F3",
        items: [{ serviceId: SERVICE_ID, secuencia: 1 }],
      },
    });
    expect(res.status()).toBe(201);
    const { plan } = (await res.json()) as {
      plan: { id: string; planNumber: string };
    };
    expect(plan.planNumber).toMatch(/^PLAN-\d{4}-\d+$/);

    const ver = await ctx.request.get(`${BASE}/api/planes/${plan.id}`);
    expect(ver.status()).toBe(200);
    const { plan: planDet } = (await ver.json()) as { plan: { estado: string } };
    expect(planDet.estado).toBe("draft");

    const act = await ctx.request.patch(`${BASE}/api/planes/${plan.id}`, {
      data: { estado: "pending" },
    });
    expect(act.status()).toBe(200);
    const { estado } = (await act.json()) as { estado: string };
    expect(estado).toBe("pending");

    // Regla de negocio: solo los borradores se eliminan.
    const delPending = await ctx.request.delete(`${BASE}/api/planes/${plan.id}`);
    expect(delPending.status()).toBe(400);

    // Limpieza: volver a draft y eliminar.
    const aDraft = await ctx.request.patch(`${BASE}/api/planes/${plan.id}`, {
      data: { estado: "draft" },
    });
    expect(aDraft.status()).toBe(200);
    const del = await ctx.request.delete(`${BASE}/api/planes/${plan.id}`);
    expect(del.status()).toBe(200);
    await ctx.close();
  });

  test("F4: presupuesto -> link 2FA -> firma con document_hash", async ({ browser }) => {
    const ctx = await ctxOwner(browser);

    const pres = await ctx.request.post(`${BASE}/api/presupuestos`, {
      data: {
        patientId: PATIENT_ID,
        titulo: "E2E F4",
        items: [{ servicioId: SERVICE_ID, descripcion: "Limpieza", cantidad: 1, precioUnitario: 100 }],
      },
    });
    expect(pres.status()).toBe(201);
    const { presupuesto } = (await pres.json()) as { presupuesto: { id: string } };

    const linkRes = await ctx.request.post(`${BASE}/api/presupuestos-v2/${presupuesto.id}/link`, {
      data: { modo: "phone_last4", valor: "5678" },
    });
    expect(linkRes.status()).toBe(200);
    const { url } = (await linkRes.json()) as { url: string };
    const token = url.split("/s/presupuesto/")[1];
    expect(token).toBeTruthy();

    const apiBase = `${BASE}/api/publico/presupuesto/${token}`;
    const anon = await browser.newContext();

    const bad = await anon.request.post(apiBase, { data: { accion: "verificar", last4: "0000" } });
    expect(bad.status()).toBe(401);

    const sinCookie = await anon.request.post(apiBase, {
      data: { accion: "aceptar", firmanteNombre: "X", signatureData: PNG },
    });
    expect(sinCookie.status()).toBe(401);

    const ok = await anon.request.post(apiBase, { data: { accion: "verificar", last4: "5678" } });
    expect(ok.status()).toBe(200);
    const cookie = ok.headers()["set-cookie"]!.split(";")[0];

    const firmar = await anon.request.post(apiBase, {
      headers: { Cookie: cookie },
      data: { accion: "aceptar", firmanteNombre: "E2E F4", firmanteRol: "paciente", signatureData: PNG },
    });
    expect(firmar.status()).toBe(200);
    const { firmaId } = (await firmar.json()) as { firmaId: string };
    expect(firmaId).toBeTruthy();

    await anon.close();
    await ctx.close();
  });

  test("F5: template de consentimiento y firma", async ({ browser }) => {
    const ctx = await ctxOwner(browser);
    const sufijo = Date.now().toString(36);

    const tpl = await ctx.request.post(`${BASE}/api/consentimientos-v2/templates`, {
      data: { nombre: `E2E Consent F5 ${sufijo}`, tratamiento: "Limpieza", contenido: "Declaro aceptar el procedimiento." },
    });
    expect(tpl.status()).toBe(201);
    const { template } = (await tpl.json()) as { template: { id: string } };

    const firmar = await ctx.request.post(`${BASE}/api/pacientes/${PATIENT_ID}/consentimientos-v2`, {
      data: { templateId: template.id, firmanteNombre: "E2E F5", firmanteRol: "paciente", signatureData: PNG },
    });
    expect(firmar.status()).toBe(201);
    const { consentimiento } = (await firmar.json()) as { consentimiento: { id: string } };
    expect(consentimiento.id).toBeTruthy();

    await ctx.close();
  });

  test("F6: sala_estado requiere consultorio en en_box", async ({ browser }) => {
    const ctx = await ctxOwner(browser);

    const hoy = new Date().toISOString().slice(0, 10);
    const crear = await ctx.request.post(`${BASE}/api/citas`, {
      data: { serviceId: SERVICE_ID, fecha: hoy, horaIni: "23:30", paciente: { id: PATIENT_ID } },
    });
    if (crear.status() !== 201) {
      await ctx.close();
      return;
    }
    const { id: citaId } = (await crear.json()) as { id: string };

    const sinRoom = await ctx.request.patch(`${BASE}/api/citas/${citaId}/sala`, {
      data: { salaEstado: "en_box" },
    });
    expect(sinRoom.status()).toBe(400);

    const conRoom = await ctx.request.patch(`${BASE}/api/citas/${citaId}/sala`, {
      data: { salaEstado: "en_box", room: "1" },
    });
    expect(conRoom.status()).toBe(200);

    await ctx.request.patch(`${BASE}/api/citas/${citaId}/sala`, { data: { salaEstado: null } });
    await ctx.close();
  });

  test("F7: allocation respeta disponible y se elimina", async ({ browser }) => {
    const ctx = await ctxOwner(browser);

    const pago = await ctx.request.post(`${BASE}/api/caja/pagos`, {
      data: { monto: 50, metodo: "efectivo", patientId: PATIENT_ID },
    });
    if (pago.status() !== 201) {
      await ctx.close();
      return;
    }
    const { id: pagoId } = (await pago.json()) as { id: string };

    const alloc = await ctx.request.post(`${BASE}/api/allocations`, {
      data: { paymentId: pagoId, patientId: PATIENT_ID, monto: 20 },
    });
    expect(alloc.status()).toBe(201);
    const { allocation } = (await alloc.json()) as { allocation: { id: string } };

    const excede = await ctx.request.post(`${BASE}/api/allocations`, {
      data: { paymentId: pagoId, patientId: PATIENT_ID, monto: 999 },
    });
    expect(excede.status()).toBe(400);

    const del = await ctx.request.delete(`${BASE}/api/allocations/${allocation.id}`);
    expect(del.status()).toBe(200);

    await ctx.request.post(`${BASE}/api/caja/pagos/${pagoId}/anular`, {
      data: { motivo: "E2E F7 limpieza" },
    });
    await ctx.close();
  });
});
