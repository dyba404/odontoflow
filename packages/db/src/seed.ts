import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { randomBytes, scryptSync } from "node:crypto";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, isNull, and, sql, asc } from "drizzle-orm";
import * as schema from "./schema.js";
import {
  upsertFundador,
  FOUNDER_EMAIL_DEV,
  FOUNDER_NAME_DEV,
  FOUNDER_PASSWORD_DEV,
} from "./fundador.js";

const DEMO_PASSWORD = "demo1234";

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const key = scryptSync(password, salt, 64);
  return `scrypt:${salt}:${Buffer.from(key).toString("hex")}`;
}

const here = dirname(fileURLToPath(import.meta.url));
const envFile = resolve(here, "../../../.env.local");
if (!process.env.DATABASE_URL && existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && m[1]) process.env[m[1]] = m[2] ?? "";
  }
}

const urlEnv = process.env.DATABASE_URL;
if (!urlEnv) throw new Error("DATABASE_URL no definido");
const url: string = urlEnv;

let client: postgres.Sql<Record<string, unknown>> | null = null;
let db: ReturnType<typeof drizzle> | null = null;

function connect(): { client: postgres.Sql<Record<string, unknown>>; db: NonNullable<typeof db> } {
  client = postgres(url, { max: 1, connect_timeout: 10, ssl: false, idle_timeout: 5 });
  db = drizzle(client, { schema });
  return { client, db };
}

function fechaLima(offsetDias = 0): string {
  const d = new Date(Date.now() + offsetDias * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(d);
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 6): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      connect();
      return await fn();
    } catch (e) {
      lastErr = e;
      if (client) await client.end({ timeout: 1 }).catch(() => {});
      const msg = e instanceof Error ? e.message : String(e);
      const transient = /CONNECTION_CLOSED|ECONNREFUSED|connect/i.test(msg);
      if (!transient || i === attempts - 1) throw e;
      console.warn(`Reintentando en 4s (${msg.slice(0, 40)}...)`);
      await new Promise((r) => setTimeout(r, 4000));
    }
  }
  throw lastErr;
}

async function heal(d: NonNullable<typeof db>, tenantId: string) {
  const sinPass = await d
    .select({ id: schema.users.id, email: schema.users.email })
    .from(schema.users)
    .where(isNull(schema.users.passwordHash))
    .limit(50);
  if (sinPass.length > 0) {
    for (const u of sinPass) {
      await d
        .update(schema.users)
        .set({ passwordHash: hashPassword(DEMO_PASSWORD) })
        .where(eq(schema.users.id, u.id));
    }
    console.log(`Seed saneado: ${sinPass.length} usuarios recibieron password "${DEMO_PASSWORD}".`);
    for (const u of sinPass) {
      console.log(`  ${u.email} / ${DEMO_PASSWORD}`);
    }
  }
  const settings = await d
    .select({ tenantId: schema.notificationSettings.tenantId })
    .from(schema.notificationSettings)
    .where(eq(schema.notificationSettings.tenantId, tenantId))
    .limit(1);
  if (settings.length === 0) {
    await d.insert(schema.notificationSettings).values({ tenantId });
  }
}

async function sanearDemo(d: NonNullable<typeof db>, tenantId: string) {
  let tocado = false;

  const sinEmail = await d.execute(
    sql`UPDATE ${schema.patients} SET ${sql.identifier("email")} = 'paciente' || sub.rn || '@example.com'
        FROM (
          SELECT ${schema.patients.id} AS id,
                 row_number() OVER (ORDER BY ${schema.patients.createdAt}, ${schema.patients.id}) AS rn
          FROM ${schema.patients}
          WHERE ${schema.patients.tenantId} = ${tenantId}
            AND ${schema.patients.email} IS NULL
        ) sub
        WHERE ${schema.patients.id} = sub.id`,
  );
  if (Number(sinEmail.count ?? 0) > 0) {
    console.log(`Sanear: ${sinEmail.count} pacientes recibieron email demo.`);
    tocado = true;
  }

  const hoy = fechaLima(0);
  const subsAct = await d
    .select({ vence: schema.subscriptions.vence })
    .from(schema.subscriptions)
    .where(
      and(
        eq(schema.subscriptions.tenantId, tenantId),
        eq(schema.subscriptions.estado, "activo"),
      ),
    )
    .limit(1);
  if (subsAct[0] && subsAct[0]!.vence === null) {
    await d
      .update(schema.subscriptions)
      .set({ vence: fechaLima(30), updatedAt: new Date() })
      .where(eq(schema.subscriptions.tenantId, tenantId));
    console.log("Sanear: suscripción premium con vencimiento ~30 días.");
    tocado = true;
  }

  const doctores = await d
    .select({ id: schema.memberships.id })
    .from(schema.memberships)
    .where(
      and(
        eq(schema.memberships.teamId, tenantId),
        eq(schema.memberships.role, "doctor"),
        eq(schema.memberships.active, true),
      ),
    );
  for (const doc of doctores) {
    const [sabado] = await d
      .select({ id: schema.staffSchedules.id })
      .from(schema.staffSchedules)
      .where(
        and(
          eq(schema.staffSchedules.membershipId, doc.id),
          eq(schema.staffSchedules.dayOfWeek, 6),
        ),
      )
      .limit(1);
    if (!sabado) {
      await d.insert(schema.staffSchedules).values({
        membershipId: doc.id,
        dayOfWeek: 6,
        horaIni: "09:00",
        horaFin: "14:00",
      });
      console.log("Sanear: turno de sábado agregado a un doctor.");
      tocado = true;
    }
  }

  const [pagosHoy] = await d
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.payments)
    .where(
      and(
        eq(schema.payments.tenantId, tenantId),
        sql`(${schema.payments.createdAt} AT TIME ZONE 'America/Lima')::date = ${hoy}`,
      ),
    );
  const faltan = 2 - Number(pagosHoy?.n ?? 0);
  if (faltan > 0) {
    const pacientes = await d
      .select({ id: schema.patients.id })
      .from(schema.patients)
      .where(eq(schema.patients.tenantId, tenantId))
      .orderBy(asc(schema.patients.createdAt))
      .limit(faltan);
    const filas = pacientes.map((p, i) => ({
      tenantId,
      patientId: p.id,
      monto: i === 0 ? "80.00" : "150.00",
      metodo: (i === 0 ? "yape" : "efectivo") as "yape" | "efectivo",
      referencia: `DEMO-${Date.now()}-${i + 1}`,
    }));
    if (filas.length > 0) {
      await d.insert(schema.payments).values(filas);
      console.log(`Sanear: ${filas.length} pagos de hoy agregados.`);
      tocado = true;
    }
  }

  const [manual] = await d
    .select({ id: schema.receipts.id })
    .from(schema.receipts)
    .where(
      and(
        eq(schema.receipts.tenantId, tenantId),
        eq(schema.receipts.sunatEstado, "manual"),
      ),
    )
    .limit(1);
  if (!manual) {
    const sinComp = await d
      .select({ id: schema.payments.id })
      .from(schema.payments)
      .leftJoin(schema.receipts, eq(schema.receipts.paymentId, schema.payments.id))
      .where(
        and(
          eq(schema.payments.tenantId, tenantId),
          isNull(schema.receipts.id),
        ),
      )
      .orderBy(asc(schema.payments.createdAt))
      .limit(1);
    if (sinComp.length > 0) {
      const [corr] = await d
        .select({ m: sql<number>`COALESCE(MAX(${schema.receipts.correlativo}), 0) + 1` })
        .from(schema.receipts)
        .where(
          and(
            eq(schema.receipts.tenantId, tenantId),
            eq(schema.receipts.tipo, "boleta"),
            eq(schema.receipts.serie, "B001"),
          ),
        );
      await d.insert(schema.receipts).values({
        tenantId,
        paymentId: sinComp[0]!.id,
        tipo: "boleta",
        serie: "B001",
        correlativo: Number(corr?.m ?? 1),
        estado: "manual",
        sunatEstado: "manual",
        emitidaAt: new Date(),
      });
      console.log("Sanear: comprobante manual emitido.");
      tocado = true;
    }
  }

  if (!tocado) console.log("Sanear demo: datos ya completos, nada que hacer.");
}

const ASEGURADORAS_DEMO = [
  { nombre: "Rímac EPS", ruc: "20411490001", telefono: "01-612-4000" },
  { nombre: "Pacífico Seguros", ruc: "20331135077", telefono: "01-513-5000" },
  { nombre: "Mapfre Perú", ruc: "20418893167", telefono: "01-213-3333" },
] as const;

async function upsertAseguradoras(d: NonNullable<typeof db>, tenantId: string) {
  const existentes = await d
    .select({ id: schema.insurers.id, nombre: schema.insurers.nombre })
    .from(schema.insurers)
    .where(eq(schema.insurers.tenantId, tenantId));
  const porNombre = new Map(existentes.map((r) => [r.nombre, r.id]));
  const ids = new Map<string, string>();
  for (const a of ASEGURADORAS_DEMO) {
    const prev = porNombre.get(a.nombre);
    if (prev) {
      ids.set(a.nombre, prev);
    } else {
      const [row] = await d
        .insert(schema.insurers)
        .values({ tenantId, nombre: a.nombre, ruc: a.ruc, telefono: a.telefono })
        .returning({ id: schema.insurers.id });
      ids.set(a.nombre, row!.id);
    }
  }
  const nuevas = ASEGURADORAS_DEMO.length - porNombre.size;
  if (nuevas > 0) console.log(`Demo: ${nuevas} aseguradoras creadas.`);
  return ids;
}

async function upsertCoberturas(
  d: NonNullable<typeof db>,
  tenantId: string,
  insurers: Map<string, string>,
) {
  const pacientes = await d
    .select({ id: schema.patients.id })
    .from(schema.patients)
    .where(eq(schema.patients.tenantId, tenantId))
    .orderBy(asc(schema.patients.createdAt))
    .limit(4);
  const planes: Array<{ patient: string; insurer: string; plan: string; copago: string }> = [];
  if (pacientes[0]) planes.push({ patient: pacientes[0].id, insurer: "Rímac EPS", plan: "Preferente", copago: "20.00" });
  if (pacientes[1]) planes.push({ patient: pacientes[1].id, insurer: "Pacífico Seguros", plan: "Vital", copago: "30.00" });
  if (pacientes[2]) planes.push({ patient: pacientes[2].id, insurer: "Mapfre Perú", plan: "Salud Total", copago: "10.00" });
  if (pacientes[3]) planes.push({ patient: pacientes[3].id, insurer: "Rímac EPS", plan: "Clásico", copago: "25.00" });

  const existentes = await d
    .select({ id: schema.patientCoverages.id, patientId: schema.patientCoverages.patientId })
    .from(schema.patientCoverages)
    .innerJoin(
      schema.patients,
      eq(schema.patientCoverages.patientId, schema.patients.id),
    )
    .where(eq(schema.patients.tenantId, tenantId));
  const pacientesConCobertura = new Set(existentes.map((r) => r.patientId));

  const filas = planes.filter((p) => !pacientesConCobertura.has(p.patient));
  if (filas.length === 0) return 0;
  await d.insert(schema.patientCoverages).values(
    filas.map((p) => ({
      patientId: p.patient,
      insurerId: insurers.get(p.insurer) ?? "",
      plan: p.plan,
      copagoPct: p.copago,
      vigenteDesde: fechaLima(-90),
      vigenteHasta: fechaLima(365),
    })),
  );
  return filas.length;
}

const PRODUCTOS_DEMO = [
  { nombre: "Guantes de nitrilo (caja x100)", categoria: "insumos", unidad: "caja", stock: "24.00", stockMin: "5.00", costoUnit: "18.50", lote: "GN-2401", cantidad: "24.00", vence: 365 },
  { nombre: "Anestesia lidocaína 2% (frasco)", categoria: "anestesia", unidad: "frasco", stock: "12.00", stockMin: "3.00", costoUnit: "22.00", lote: "LIDO-0925", cantidad: "12.00", vence: 300 },
  { nombre: "Resina compuesta A2 (jeringa)", categoria: "materiales", unidad: "jeringa", stock: "8.00", stockMin: "2.00", costoUnit: "45.00", lote: null, cantidad: null, vence: null },
  { nombre: "Puntas de irrigación (pack x50)", categoria: "insumos", unidad: "pack", stock: "15.00", stockMin: "4.00", costoUnit: "12.00", lote: "PI-2503", cantidad: "15.00", vence: 540 },
  { nombre: "Ácido ortofosfórico 37% (jeringa)", categoria: "materiales", unidad: "jeringa", stock: "2.00", stockMin: "3.00", costoUnit: "15.00", lote: null, cantidad: null, vence: null },
] as const;

async function upsertInventario(
  d: NonNullable<typeof db>,
  tenantId: string,
  createdById: string | null,
) {
  const existentes = await d
    .select({ id: schema.inventoryItems.id, nombre: schema.inventoryItems.nombre })
    .from(schema.inventoryItems)
    .where(eq(schema.inventoryItems.tenantId, tenantId));
  const porNombre = new Map(existentes.map((r) => [r.nombre, r.id]));
  let nuevos = 0;
  let lotes = 0;
  for (const p of PRODUCTOS_DEMO) {
    let itemId = porNombre.get(p.nombre);
    if (!itemId) {
      const [row] = await d
        .insert(schema.inventoryItems)
        .values({
          tenantId,
          nombre: p.nombre,
          categoria: p.categoria,
          unidad: p.unidad,
          stock: p.stock,
          stockMin: p.stockMin,
          costoUnit: p.costoUnit,
        })
        .returning({ id: schema.inventoryItems.id });
      itemId = row!.id;
      porNombre.set(p.nombre, itemId);
      nuevos++;
      await d.insert(schema.stockMovements).values({
        tenantId,
        itemId,
        tipo: "ingreso",
        cantidad: p.stock,
        nota: "Inventario inicial (demo)",
        createdBy: createdById,
      });
    }
    if (p.lote) {
      const [yaLote] = await d
        .select({ id: schema.inventoryLots.id })
        .from(schema.inventoryLots)
        .where(and(eq(schema.inventoryLots.itemId, itemId), eq(schema.inventoryLots.lote, p.lote)))
        .limit(1);
      if (!yaLote) {
        await d.insert(schema.inventoryLots).values({
          itemId,
          lote: p.lote,
          vence: p.vence !== null ? fechaLima(p.vence) : null,
          cantidad: p.cantidad ?? "0",
        });
        lotes++;
      }
    }
  }
  if (nuevos > 0) console.log(`Demo: ${nuevos} productos de inventario con stock y kardex.`);
  if (lotes > 0) console.log(`Demo: ${lotes} lotes de inventario.`);
}

async function upsertLabOrders(d: NonNullable<typeof db>, tenantId: string) {
  const [cuenta] = await d
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.labOrders)
    .where(eq(schema.labOrders.tenantId, tenantId));
  if (Number(cuenta?.n ?? 0) >= 2) return 0;
  const pacientes = await d
    .select({ id: schema.patients.id })
    .from(schema.patients)
    .where(eq(schema.patients.tenantId, tenantId))
    .orderBy(asc(schema.patients.createdAt))
    .limit(4);
  if (pacientes.length === 0) return 0;
  const filas: Array<typeof schema.labOrders.$inferInsert> = [
    {
      tenantId,
      patientId: pacientes[0]!.id,
      tipo: "Corona de porcelana",
      laboratorio: "DentalLab Lima",
      fechaPromesa: fechaLima(7),
      costo: "350.00",
      estado: "fabricacion",
      notas: "Pieza 46, tono A2",
    },
  ];
  if (pacientes[1]) {
    filas.push({
      tenantId,
      patientId: pacientes[1].id,
      tipo: "Placa miorrelajante",
      laboratorio: "OrtoPro",
      fechaPromesa: fechaLima(14),
      costo: "180.00",
      estado: "enviado",
      notas: null,
    });
  }
  await d.insert(schema.labOrders).values(filas);
  return filas.length;
}

async function upsertPresupuestos(
  d: NonNullable<typeof db>,
  tenantId: string,
  createdById: string | null,
) {
  const [cuenta] = await d
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.quotes)
    .where(eq(schema.quotes.tenantId, tenantId));
  if (Number(cuenta?.n ?? 0) >= 3) return 0;
  const pacientes = await d
    .select({ id: schema.patients.id })
    .from(schema.patients)
    .where(eq(schema.patients.tenantId, tenantId))
    .orderBy(asc(schema.patients.createdAt))
    .limit(5);
  if (pacientes.length === 0) return 0;
  const mkItems = (arr: Array<[string, number, string]>) =>
    arr.map(([descripcion, cantidad, precio]) => ({
      servicioId: null,
      descripcion,
      cantidad,
      precioUnitario: Number(precio),
    }));
  const presupuestoA = mkItems([
    ["Limpieza dental", 1, "80.00"],
    ["Resina / empaste", 2, "150.00"],
  ]);
  const presupuestoB = mkItems([["Endodoncia (1ra sesión)", 1, "250.00"]]);
  const presupuestoC = mkItems([
    ["Blanqueamiento", 1, "600.00"],
    ["Limpieza dental", 1, "80.00"],
  ]);
  const base = {
    tenantId,
    createdBy: createdById,
    expiraEn: fechaLima(30),
  };
  const filas = [
    { ...base, patientId: pacientes[0]!.id, titulo: "Plan básico de rehabilitación", items: presupuestoA, total: "380.00", estado: "enviado" as const },
    { ...base, patientId: pacientes[1]!.id, titulo: "Endodoncia pieza 26", items: presupuestoB, total: "250.00", estado: "aprobado" as const },
    { ...base, patientId: pacientes[2]!.id, titulo: "Blanqueamiento + limpieza", items: presupuestoC, total: "680.00", estado: "enviado" as const },
  ];
  const creados = await d.insert(schema.quotes).values(filas).returning({ id: schema.quotes.id });
  return creados.length;
}

async function upsertCuotas(d: NonNullable<typeof db>, tenantId: string) {
  const existente = await d
    .select({ id: schema.installments.id })
    .from(schema.installments)
    .innerJoin(schema.patients, eq(schema.installments.patientId, schema.patients.id))
    .where(eq(schema.patients.tenantId, tenantId))
    .limit(1);
  if (existente.length > 0) return 0;
  const [aprobado] = await d
    .select({
      id: schema.quotes.id,
      patientId: schema.quotes.patientId,
      total: schema.quotes.total,
    })
    .from(schema.quotes)
    .where(and(eq(schema.quotes.tenantId, tenantId), eq(schema.quotes.estado, "aprobado")))
    .orderBy(asc(schema.quotes.createdAt))
    .limit(1);
  if (!aprobado) return 0;
  const montoCuota = (Math.round(Number(aprobado.total) / 2 * 100) / 100).toFixed(2);
  const pagosExistentes = await d
    .select({ id: schema.payments.id, metodo: schema.payments.metodo })
    .from(schema.payments)
    .where(and(eq(schema.payments.tenantId, tenantId), eq(schema.payments.patientId, aprobado.patientId)))
    .limit(1);
  let pagoId: string | null = null;
  if (pagosExistentes[0] && pagosExistentes[0].metodo === "yape") {
    pagoId = pagosExistentes[0].id;
  } else {
    const [nuevo] = await d
      .insert(schema.payments)
      .values({
        tenantId,
        patientId: aprobado.patientId,
        monto: montoCuota,
        metodo: "yape",
        referencia: `CUOTA1-${aprobado.id.slice(0, 8)}`,
        estado: "valido",
      })
      .returning({ id: schema.payments.id });
    pagoId = nuevo!.id;
  }
  await d.insert(schema.installments).values([
    {
      tenantId,
      patientId: aprobado.patientId,
      quoteId: aprobado.id,
      concepto: "Cuota 1 de 2",
      n: 1,
      monto: montoCuota,
      pagado: montoCuota,
      vence: fechaLima(15),
      estado: "pagada",
      paymentId: pagoId,
    },
    {
      tenantId,
      patientId: aprobado.patientId,
      quoteId: aprobado.id,
      concepto: "Cuota 2 de 2",
      n: 2,
      monto: montoCuota,
      vence: fechaLima(45),
      estado: "pendiente",
    },
  ]);
  return 2;
}

async function enriquecerDemo(d: NonNullable<typeof db>, tenantId: string) {
  const [ownerMember] = await d
    .select({ userId: schema.memberships.userId })
    .from(schema.memberships)
    .where(and(eq(schema.memberships.teamId, tenantId), eq(schema.memberships.role, "owner")))
    .limit(1);
  const createdById = ownerMember?.userId ?? null;

  const insurers = await upsertAseguradoras(d, tenantId);
  const coberturas = await upsertCoberturas(d, tenantId, insurers);
  await upsertInventario(d, tenantId, createdById);
  const labs = await upsertLabOrders(d, tenantId);
  const presupuestos = await upsertPresupuestos(d, tenantId, createdById);
  const cuotas = await upsertCuotas(d, tenantId);

  if (coberturas + labs + presupuestos + cuotas > 0) {
    console.log(
      `Enriquecer demo: +${coberturas} coberturas, +${labs} órdenes de laboratorio, +${presupuestos} presupuestos, +${cuotas} cuotas.`,
    );
  } else {
    console.log("Enriquecer demo: datos ya completos, nada que hacer.");
  }
}

async function seedFundador(d: NonNullable<typeof db>) {
  const { creado } = await upsertFundador(d, {
    email: FOUNDER_EMAIL_DEV,
    name: FOUNDER_NAME_DEV,
    passwordHash: hashPassword(FOUNDER_PASSWORD_DEV),
  });
  if (creado) {
    console.log(
      `Fundador creado: ${FOUNDER_EMAIL_DEV} (contraseña TEMPORAL, se cambia en el primer login).`,
    );
  }
}

async function run() {
  if (!db) throw new Error("sin conexión a Postgres");
  const d = db;
  const existing = await d.select({ id: schema.teams.id }).from(schema.teams).limit(1);
  if (existing.length > 0) {
    await heal(d, existing[0]!.id);
    await sanearDemo(d, existing[0]!.id);
    await enriquecerDemo(d, existing[0]!.id);
    await seedFundador(d);
    return;
  }

  const ayer = fechaLima(-1);
  const hoy = fechaLima(0);
  const manana = fechaLima(1);

  await d.transaction(async (tx) => {
    await tx.insert(schema.users).values([
      { name: "Dra. Ana Valdéz", email: "owner@demo.odontoflow.pe", passwordHash: hashPassword(DEMO_PASSWORD) },
      { name: "Carlos Mendoza", email: "recepcion@demo.odontoflow.pe", passwordHash: hashPassword(DEMO_PASSWORD) },
      { name: "Dr. Luis Pérez", email: "luis@demo.odontoflow.pe", passwordHash: hashPassword(DEMO_PASSWORD) },
      { name: "Dra. María Torres", email: "maria@demo.odontoflow.pe", passwordHash: hashPassword(DEMO_PASSWORD) },
      { name: "Florencia Ríos", email: "asistente@demo.odontoflow.pe", passwordHash: hashPassword(DEMO_PASSWORD) },
    ]);

    const team = (await tx
      .insert(schema.teams)
      .values({
        name: "Clínica Dental Sonrisa",
        slug: "dental",
        timezone: "America/Lima",
        bookingMode: "solicitud",
      })
      .returning())[0]!;

    await tx
      .insert(schema.subscriptions)
      .values({ tenantId: team.id, plan: "premium", estado: "activo", vence: fechaLima(30) });

    const allUsers = await tx.select().from(schema.users);
    const by = (e: string) => allUsers.find((u) => u.email === e)!;

    const members = await tx
      .insert(schema.memberships)
      .values([
        { teamId: team.id, userId: by("owner@demo.odontoflow.pe").id, role: "owner" },
        { teamId: team.id, userId: by("recepcion@demo.odontoflow.pe").id, role: "receptionist" },
        { teamId: team.id, userId: by("luis@demo.odontoflow.pe").id, role: "doctor" },
        { teamId: team.id, userId: by("maria@demo.odontoflow.pe").id, role: "doctor" },
        { teamId: team.id, userId: by("asistente@demo.odontoflow.pe").id, role: "assistant" },
      ])
      .returning();
    const [, , docLuis, docMaria] = members;
    const mluis = docLuis!.id;
    const mmaria = docMaria!.id;

    const weekdays = [1, 2, 3, 4, 5];
    const sched: Array<{ membershipId: string; dayOfWeek: number; horaIni: string; horaFin: string }> = [];
    for (const dow of weekdays) {
      sched.push(
        { membershipId: mluis, dayOfWeek: dow, horaIni: "08:00", horaFin: "13:00" },
        { membershipId: mluis, dayOfWeek: dow, horaIni: "14:00", horaFin: "19:00" },
        { membershipId: mmaria, dayOfWeek: dow, horaIni: "09:00", horaFin: "14:00" },
        { membershipId: mmaria, dayOfWeek: dow, horaIni: "15:00", horaFin: "18:30" },
      );
    }
    sched.push(
      { membershipId: mmaria, dayOfWeek: 6, horaIni: "09:00", horaFin: "14:00" },
      { membershipId: mluis, dayOfWeek: 6, horaIni: "09:00", horaFin: "13:00" },
    );
    await tx.insert(schema.staffSchedules).values(sched);

    const svcs = await tx
      .insert(schema.services)
      .values([
        { tenantId: team.id, nombre: "Limpieza dental", duracionMin: 30, precio: "80.00", bufferMin: 5 },
        { tenantId: team.id, nombre: "Resina / empaste", duracionMin: 45, precio: "150.00", bufferMin: 10 },
        { tenantId: team.id, nombre: "Extracción simple", duracionMin: 40, precio: "120.00", bufferMin: 15 },
        { tenantId: team.id, nombre: "Endodoncia (1ra sesión)", duracionMin: 60, precio: "250.00", bufferMin: 15 },
      ])
      .returning();
    const [sLimpieza, sResina, sExtraccion, sEndo] = svcs;

    const pats = await tx
      .insert(schema.patients)
      .values([
        { tenantId: team.id, nombre: "Elena Torres R.", celular: "987654321", email: "paciente1@example.com" },
        { tenantId: team.id, nombre: "Ricardo Salas M.", celular: "912345678", email: "paciente2@example.com" },
        { tenantId: team.id, nombre: "Carmen Delgado P.", celular: "923456789", email: "paciente3@example.com" },
        { tenantId: team.id, nombre: "José Quispe H.", celular: "934567890", email: "paciente4@example.com" },
        { tenantId: team.id, nombre: "Lucía Fernández V.", celular: "945678901", email: "paciente5@example.com" },
        { tenantId: team.id, nombre: "Miguel Ramos C.", celular: "956789012", email: "paciente6@example.com" },
        { tenantId: team.id, nombre: "Sofía Herrera L.", celular: "967890123", email: "paciente7@example.com" },
        { tenantId: team.id, nombre: "Alejandro Ortiz N.", celular: "978901234", email: "paciente8@example.com" },
      ])
      .returning();
    const [pElena, pRicardo, pCarmen, pJose, pLucia, pMiguel, pSofia, pAlejandro] = pats;

    type Appt = {
      fecha: string; ini: string; fin: string; estado: string; svc: string;
      pat: string; doc: string | null; pref?: string | null; monto: string; pagado?: string; notas?: string;
    };
    const appts: Appt[] = [
      { fecha: ayer, ini: "10:00", fin: "10:30", estado: "atendida", svc: sLimpieza!.id, pat: pCarmen!.id, doc: mluis, monto: "80.00" },
      { fecha: ayer, ini: "15:00", fin: "15:45", estado: "atendida", svc: sResina!.id, pat: pMiguel!.id, doc: mmaria, monto: "150.00" },
      { fecha: hoy, ini: "08:30", fin: "09:00", estado: "atendida", svc: sLimpieza!.id, pat: pElena!.id, doc: mluis, monto: "80.00", pagado: "80.00" },
      { fecha: hoy, ini: "09:30", fin: "10:15", estado: "atendida", svc: sResina!.id, pat: pRicardo!.id, doc: mmaria, monto: "150.00", pagado: "150.00" },
      { fecha: hoy, ini: "10:30", fin: "11:10", estado: "atendida", svc: sExtraccion!.id, pat: pCarmen!.id, doc: mluis, monto: "120.00", pagado: "120.00" },
      { fecha: hoy, ini: "11:15", fin: "12:15", estado: "atendida", svc: sEndo!.id, pat: pJose!.id, doc: mmaria, monto: "250.00", pagado: "150.00" },
      { fecha: hoy, ini: "14:00", fin: "14:30", estado: "confirmada", svc: sLimpieza!.id, pat: pLucia!.id, doc: mluis, monto: "80.00" },
      { fecha: hoy, ini: "15:00", fin: "15:45", estado: "confirmada", svc: sResina!.id, pat: pMiguel!.id, doc: mmaria, monto: "150.00" },
      { fecha: hoy, ini: "16:00", fin: "16:40", estado: "confirmada", svc: sExtraccion!.id, pat: pSofia!.id, doc: mluis, monto: "120.00" },
      { fecha: hoy, ini: "17:00", fin: "17:30", estado: "confirmada", svc: sLimpieza!.id, pat: pAlejandro!.id, doc: mmaria, monto: "80.00" },
      { fecha: manana, ini: "10:00", fin: "10:30", estado: "solicitada", svc: sLimpieza!.id, pat: pElena!.id, doc: null, monto: "80.00", notas: "Primera limpieza del año" },
      { fecha: manana, ini: "11:30", fin: "12:15", estado: "solicitada", svc: sResina!.id, pat: pRicardo!.id, doc: null, pref: mmaria, monto: "150.00", notas: "Mole con frío al masticar" },
      { fecha: manana, ini: "16:00", fin: "17:00", estado: "solicitada", svc: sEndo!.id, pat: pJose!.id, doc: null, pref: mmaria, monto: "250.00", notas: "Continuar tratamiento" },
    ];

    for (const a of appts) {
      await tx.insert(schema.appointments).values({
        tenantId: team.id,
        serviceId: a.svc,
        patientId: a.pat,
        doctorId: a.doc,
        preferredDoctorId: a.pref ?? a.doc,
        fecha: a.fecha,
        horaIni: a.ini,
        horaFin: a.fin,
        estado: a.estado as never,
        modoSolicitud: a.estado === "solicitada",
        monto: a.monto,
        montoPagado: a.pagado ?? "0.00",
        notas: a.notas ?? null,
      });
    }

    const pagos = await tx
      .insert(schema.payments)
      .values([
        { tenantId: team.id, patientId: pCarmen!.id, monto: "80.00", metodo: "yape", referencia: "YAPE-4451" },
        { tenantId: team.id, patientId: pMiguel!.id, monto: "150.00", metodo: "efectivo" },
        { tenantId: team.id, patientId: pElena!.id, monto: "80.00", metodo: "plin", referencia: "PLIN-8821" },
        { tenantId: team.id, patientId: pRicardo!.id, monto: "150.00", metodo: "yape", referencia: "YAPE-4452" },
        { tenantId: team.id, patientId: pCarmen!.id, monto: "120.00", metodo: "efectivo" },
        { tenantId: team.id, patientId: pJose!.id, monto: "150.00", metodo: "tarjeta_pos", referencia: "POS-00124" },
      ])
      .returning();

    await tx.insert(schema.receipts).values({
      tenantId: team.id,
      paymentId: pagos[0]!.id,
      tipo: "boleta",
      serie: "B001",
      correlativo: 1,
      estado: "manual",
      sunatEstado: "manual",
      emitidaAt: new Date(),
    });

    console.log("Seed aplicado OK:");
    console.log("  Team:", team.slug, "|", appts.length, "citas,", pagos.length, "pagos");
    console.log("  Acceso demo (password: demo1234):");
    console.log("    owner@demo.odontoflow.pe      (Dueño/a)");
    console.log("    recepcion@demo.odontoflow.pe  (Recepción)");
    console.log("    luis@demo.odontoflow.pe       (Doctor)");
    console.log("    maria@demo.odontoflow.pe      (Doctora)");
    console.log("    asistente@demo.odontoflow.pe  (Asistente)");
  });

  await seedFundador(d);
}

async function main() {
  await withRetry(run);
  if (client) await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
