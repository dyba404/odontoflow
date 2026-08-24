// Seed PILOTO — team "Clínica Dental Vitalia" (slug: vitalia).
// Idempotente: si el slug 'vitalia' ya existe, avisa y termina sin escribir.
// Requiere LOCAL_MASTER_KEY para cifrar vat_settings (clave SOL, certificado PEM)
// y whatsapp_settings.tokenEnc. Fechas relativas a hoy (America/Lima).
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { randomBytes, scryptSync, createCipheriv } from "node:crypto";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import * as schema from "./schema.js";

const PILOTO_SLUG = "vitalia";
const PILOTO_PASSWORD = "Vitalia2026!";

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const key = scryptSync(password, salt, 64);
  return `scrypt:${salt}:${Buffer.from(key).toString("hex")}`;
}

// ---------------------------------------------------------------------------
// Carga de .env.local (mismo patrón que fiscal-demo.ts: apps/web primero porque
// ahí vive LOCAL_MASTER_KEY; nunca sobrescribe variables ya definidas).
// ---------------------------------------------------------------------------

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../..");

function cargarEnv(ruta: string): void {
  if (!existsSync(ruta)) return;
  for (const line of readFileSync(ruta, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && m[1] && typeof process.env[m[1]] === "undefined") {
      process.env[m[1]] = m[2] ?? "";
    }
  }
}

cargarEnv(resolve(root, "apps", "web", ".env.local"));
cargarEnv(resolve(root, ".env.local"));

const urlEnv = process.env.DATABASE_URL;
if (!urlEnv) throw new Error("DATABASE_URL no definido (.env.local)");
const url: string = urlEnv;

let client: postgres.Sql<Record<string, unknown>> | null = null;
let db: ReturnType<typeof drizzle> | null = null;

function connect(): { client: postgres.Sql<Record<string, unknown>>; db: NonNullable<typeof db> } {
  client = postgres(url, { max: 1, connect_timeout: 10, ssl: false, idle_timeout: 5 });
  db = drizzle(client, { schema });
  return { client, db };
}

// ---------------------------------------------------------------------------
// Cifrado at-rest — réplica EXACTA de apps/web/src/lib/crypto.ts
// (AES-256-GCM, clave scrypt(master,"odontoflow-at-rest-v1",32), salida base64(iv|tag|enc)).
// ---------------------------------------------------------------------------

const ALGO = "aes-256-gcm";

function deriveKey(): Buffer {
  const master = process.env.LOCAL_MASTER_KEY;
  if (!master) {
    throw new Error("LOCAL_MASTER_KEY no configurada (requerida para datos cifrados)");
  }
  return scryptSync(master, "odontoflow-at-rest-v1", 32);
}

function cifrar(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, deriveKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

// ---------------------------------------------------------------------------
// Fechas America/Lima (mismo helper que seed.ts)
// ---------------------------------------------------------------------------

function fechaLima(offsetDias = 0): string {
  const d = new Date(Date.now() + offsetDias * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(d);
}

function esFinDe(fecha: string): boolean {
  const dow = new Date(`${fecha}T12:00:00Z`).getUTCDay();
  return dow === 0 || dow === 6;
}

/** N fechas hábiles (L-V) hacia atrás empezando por ayer. */
function habilesAtras(cantidad: number): string[] {
  const fechas: string[] = [];
  let off = -1;
  while (fechas.length < cantidad && off > -60) {
    const f = fechaLima(off);
    if (!esFinDe(f)) fechas.push(f);
    off--;
  }
  return fechas;
}

/** N fechas hábiles (L-V) hacia adelante empezando en offset `desde`. */
function habilesAdelante(desde: number, cantidad: number): string[] {
  const fechas: string[] = [];
  let off = desde;
  while (fechas.length < cantidad && off < 120) {
    const f = fechaLima(off);
    if (!esFinDe(f)) fechas.push(f);
    off++;
  }
  return fechas;
}

/** Primer día hábil cuyo offset sea >= `desde`. */
function primerHabilDesde(desde: number): string {
  let off = desde;
  while (off < 120) {
    const f = fechaLima(off);
    if (!esFinDe(f)) return f;
    off++;
  }
  return fechaLima(desde);
}

function sumarDias(fecha: string, dias: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(
    new Date(new Date(`${fecha}T12:00:00Z`).getTime() + dias * 86_400_000),
  );
}

// ---------------------------------------------------------------------------
// Shapes de odontograma v2 (vendor react-advanced-odontogram, version "2.20").
// Superficies válidas: buccal | lingual | mesial | distal | occlusal.
// La hidratación (ja/fromRaw) completa los ejes faltantes con defaults.
// ---------------------------------------------------------------------------

type ToothEntry = Record<string, unknown>;

function toothCariado(superficie: string, severidad: number): ToothEntry {
  return {
    toothSelection: "tooth-base",
    pulpDx: "normal",
    pulpLatin: "none",
    apicalDx: "normal",
    mods: [],
    periapicalType: "none",
    endo: "none",
    caries: [superficie],
    cariesActiveDepth: Math.max(1, Math.min(severidad, 4)),
    cariesSeverity: { [superficie]: severidad },
    fillingMaterial: "none",
    fillingSurfaces: [],
    fillingSurfaceMaterials: {},
    toothSubstrate: "natural",
    restorationType: "none",
    restorationMaterial: "none",
    extractionPlan: false,
  };
}

function toothRestaurado(superficie: string): ToothEntry {
  return {
    toothSelection: "tooth-base",
    caries: [],
    cariesSeverity: {},
    fillingMaterial: "composite",
    fillingSurfaces: [superficie],
    fillingSurfaceMaterials: { [superficie]: "composite" },
    toothSubstrate: "natural",
    restorationType: "none",
    restorationMaterial: "none",
    extractionPlan: false,
  };
}

function toothExodonciaIndicada(): ToothEntry {
  return {
    toothSelection: "tooth-base",
    caries: ["distal"],
    cariesSeverity: { distal: 4 },
    extractionPlan: true,
  };
}

function toothCorona(): ToothEntry {
  return {
    toothSelection: "tooth-base",
    caries: [],
    cariesSeverity: {},
    toothSubstrate: "crownprep",
    restorationType: "crown",
    restorationMaterial: "metal-ceramic",
    extractionPlan: false,
  };
}

function chartJson(teeth: Record<string, ToothEntry>): object {
  return {
    version: "2.20",
    globals: {
      wisdomVisible: true,
      showBase: true,
      occlusalVisible: true,
      showHealthyPulp: false,
      edentulous: false,
    },
    teeth,
  };
}

// Snapshot de periodontograma: mismo formato que mod.getStatusChart() del vendor
// con perio.pd por sitio `${diente}-${MB|B|DB|ML|L|DL}` (rango pd 1..15, gm -10..20).
function perioSnapshot(): object {
  const SITIOS = ["MB", "B", "DB", "ML", "L", "DL"] as const;
  const PDS = [3, 4, 3, 3, 4, 3];
  const teeth: Record<string, ToothEntry> = {};
  for (const tooth of [16, 26]) {
    const pd: Record<string, number> = {};
    const gm: Record<string, number> = {};
    for (let i = 0; i < SITIOS.length; i++) {
      const sitio = SITIOS[i]!;
      pd[`${tooth}-${sitio}`] = PDS[i]!;
      gm[`${tooth}-${sitio}`] = -1;
    }
    teeth[String(tooth)] = {
      toothSelection: "tooth-base",
      perio: { pd, gm, bop: [`${tooth}-B`], sup: [] },
      mobility: "m1",
    };
  }
  return chartJson(teeth);
}

// ---------------------------------------------------------------------------
// Textos legales para consentimientos (2–3 párrafos realistas c/u)
// ---------------------------------------------------------------------------

function consentimiento(titulo: string, descripcion: string, riesgos: string): string {
  return [
    `${titulo}\n\nYo, paciente de Clínica Dental Vitalia S.A.C., declaro haber recibido información clara y comprensible sobre el procedimiento propuesto: ${descripcion} He sido informado/a sobre su propósito, el desarrollo esperado de las sesiones, los resultados previsibles y las alternativas terapéuticas disponibles, incluyendo la opción de no realizar el tratamiento y sus consecuencias.`,
    `Riesgos y consideraciones: ${riesgos} Asimismo, entiendo que todo procedimiento odontológico implica variables biológicas propias de cada paciente, por lo que ningún resultado puede ser garantizado de manera absoluta; me comprometo a seguir las indicaciones pre y post operatorias y a asistir a los controles programados.`,
    `Protección de datos: autorizo el uso de mis datos clínicos exclusivamente para fines del tratamiento conforme a la Ley N.º 29733 (Ley de Protección de Datos Personales del Perú). Este consentimiento es voluntario, puedo revocarlo en cualquier momento antes del procedimiento, y lo firmo de manera libre y consciente, habiendo podido realizar todas las preguntas necesarias.`,
  ].join("\n\n");
}

// ---------------------------------------------------------------------------
// Seed principal
// ---------------------------------------------------------------------------

async function run() {
  if (!db) throw new Error("sin conexión a Postgres");
  const d = db;

  // --- Idempotencia: nada se escribe si el slug ya existe -------------------
  const [existente] = await d
    .select({ id: schema.teams.id })
    .from(schema.teams)
    .where(eq(schema.teams.slug, PILOTO_SLUG))
    .limit(1);
  if (existente) {
    console.log(`Seed piloto: el team slug '${PILOTO_SLUG}' ya existe. Nada que hacer.`);
    return;
  }

  // --- Validaciones ANTES de escribir cualquier fila ------------------------
  if (!process.env.LOCAL_MASTER_KEY) {
    console.error(
      "[seed-piloto] ERROR: LOCAL_MASTER_KEY no definida (se necesita para cifrar vat_settings y whatsapp_settings.tokenEnc).",
    );
    process.exit(1);
  }

  // Certificado PEM para facturación electrónica (CERT_PILOTO con default lycet).
  const rutaCert = process.env.CERT_PILOTO
    ? resolve(process.env.CERT_PILOTO)
    : resolve(root, ".references", "lycet", "tests", "Resources", "cert.pem");
  let certBase64: string | null = null;
  if (existsSync(rutaCert)) {
    certBase64 = Buffer.from(readFileSync(rutaCert, "utf8"), "utf8").toString("base64");
  } else {
    console.warn(
      `[seed-piloto] AVISO: certificado PEM no encontrado en ${rutaCert} (env CERT_PILOTO). Se guarda vat_settings sin certificado.`,
    );
  }

  const ayerHabiles = habilesAtras(6); // [D1..D6] más reciente primero
  const [d1, d2, d3, d4, d5, d6] = ayerHabiles;
  const hoy = fechaLima(0);
  const futuros = habilesAdelante(1, 5); // dentro de ~7 días naturales
  const [f1, f2, f3, f4] = futuros;
  const manana = futuros[0] ?? fechaLima(1);

  await d.transaction(async (tx) => {
    // --- Usuarios + team + suscripción -------------------------------------
    await tx.insert(schema.users).values([
      { name: "Dra. Camila Rojas", email: "duena@vitalia.pe", passwordHash: hashPassword(PILOTO_PASSWORD) },
      { name: "Luis Campos", email: "recepcion@vitalia.pe", passwordHash: hashPassword(PILOTO_PASSWORD) },
      { name: "Dra. Ana Valdéz", email: "odontologia@vitalia.pe", passwordHash: hashPassword(PILOTO_PASSWORD) },
      { name: "Kevin Soto", email: "asistente@vitalia.pe", passwordHash: hashPassword(PILOTO_PASSWORD) },
    ]);

    const team = (await tx
      .insert(schema.teams)
      .values({
        name: "Clínica Dental Vitalia",
        slug: PILOTO_SLUG,
        timezone: "America/Lima",
        bookingMode: "solicitud",
      })
      .returning())[0]!;

    await tx
      .insert(schema.subscriptions)
      .values({ tenantId: team.id, plan: "premium", estado: "activo", vence: fechaLima(30) });

    const allUsers = await tx.select().from(schema.users);
    const byEmail = (e: string) => allUsers.find((u) => u.email === e)!;
    const uDuenia = byEmail("duena@vitalia.pe");
    const uRecepcion = byEmail("recepcion@vitalia.pe");
    const uAna = byEmail("odontologia@vitalia.pe");
    const uKevin = byEmail("asistente@vitalia.pe");

    const members = await tx
      .insert(schema.memberships)
      .values([
        { teamId: team.id, userId: uDuenia.id, role: "owner" },
        { teamId: team.id, userId: uRecepcion.id, role: "receptionist" },
        { teamId: team.id, userId: uAna.id, role: "doctor" },
        { teamId: team.id, userId: uKevin.id, role: "assistant" },
      ])
      .returning();
    const [mCamila, , mAna, mKevin] = members;

    // --- Settings: notificaciones / legal / fiscal / whatsapp --------------
    await tx.insert(schema.notificationSettings).values({
      tenantId: team.id,
      resenaAutomatica: true, // config de reseñas Google (no hay tabla aparte)
    });

    await tx.insert(schema.legalSettings).values({
      tenantId: team.id,
      razonSocial: "Clínica Dental Vitalia S.A.C.",
      ruc: "20161515648",
      direccionLegal: "Av. Arequipa 2450, Lince, Lima",
      emailContactoDatos: "datos@vitalia.pe",
      telefonoContactoDatos: "01-5551234",
      updatedBy: uDuenia.id,
    });

    await tx.insert(schema.vatSettings).values({
      tenantId: team.id,
      ruc: "20161515648",
      razonSocial: "Clínica Dental Vitalia S.A.C.",
      regimen: "MYPE",
      ambiente: "beta",
      usuarioSol: "MODDATOS",
      claveSolEnc: cifrar("MODDATOS"),
      certificadoEnc: certBase64 ? cifrar(certBase64) : null,
      serieBoleta: "B001",
      corrBoleta: 1,
      serieFactura: "F001",
      corrFactura: 1,
      emision: "electronica",
      emisionAuto: false,
    });
    console.log(
      certBase64
        ? "[seed-piloto] vat_settings cifrados (claveSOL + certificado PEM)."
        : "[seed-piloto] vat_settings cifrados (claveSOL); sin certificado.",
    );

    await tx.insert(schema.whatsappSettings).values({
      tenantId: team.id,
      phoneNumberId: "109999999999999",
      tokenEnc: cifrar("mock-token-123"),
      activo: true,
    });

    // --- Consent templates --------------------------------------------------
    await tx.insert(schema.consentTemplates).values([
      {
        tenantId: team.id,
        nombre: "Consentimiento informado - Restauración",
        tratamiento: "Restauración con resina/empaste",
        contenido: consentimiento(
          "Consentimiento informado - Restauración dental",
          "reconstrucción de la pieza dentaria afectada por caries o fractura mediante restauración adhesiva con resina compuesta, que incluye remoción del tejido cariado con instrumentos rotatorios (en ocasiones bajo anestesia local), grabado ácido, colocación de material restaurador y ajuste oclusal.",
          "puede incluir sensibilidad transitoria al frío y al calor, molestias tras la anestesia, descementación o fractura de la restauración por fuerzas masticatorias excesivas, necesidad de retratamiento si la lesión progresara, y en piezas comprometidas en profundidad, riesgo de exposición pulpar que exigiría tratamiento endodóntico adicional.",
        ),
        createdBy: uDuenia.id,
      },
      {
        tenantId: team.id,
        nombre: "Consentimiento informado - Exodoncia",
        tratamiento: "Exodoncia simple",
        contenido: consentimiento(
          "Consentimiento informado - Exodoncia dental",
          "extracción quirúrgica de la pieza dentaria indicada, realizada bajo anestesia local, con luxación y avulsión del diente, control de hemostasia e indicaciones post operatorias (compresa fría, higiene suave, dieta blanda y evitación de enjuagues vigorosos las primeras 24 horas).",
          "sangrado prolongado, inflamación y dolor post operatorio, infección o alveolitis seca (dolor intenso hacia el 3.er día), lesión de raíces vecinas, seno maxilar o nervios vecinos con hipoestesia temporal, así como limitación de la apertura oral; estos eventos requieren control clínico y en ocasiones tratamiento complementario.",
        ),
        createdBy: uDuenia.id,
      },
      {
        tenantId: team.id,
        nombre: "Consentimiento informado - Endodoncia",
        tratamiento: "Tratamiento de conducto (endodoncia)",
        contenido: consentimiento(
          "Consentimiento informado - Endodoncia",
          "tratamiento de conductos de la pieza dentaria con diagnóstico de pulpitis o necrosis pulpar, que comprende aislamiento con dique de goma, limpieza y conformación de los conductos con instrumental manual o rotatorio, irrigación y obturación hermética con materiales biocompatibles, usualmente bajo anestesia local y en una o varias sesiones.",
          "dolor o inflamación post operatoria entre 2 y 5 días que cede con analgésicos, posibilidad de instrumentos separados dentro del conducto, perforaciones radiculares, conductos calcificados no navegables, reabsorciones o lesiones periapicales persistentes que obligarían a retratamiento, cirugía apical o, en última instancia, extracción de la pieza; también puede oscurecerse la corona, requiriendo blanqueamiento interno o restauración protésica.",
        ),
        createdBy: uDuenia.id,
      },
      {
        tenantId: team.id,
        nombre: "Consentimiento informado - Limpieza",
        tratamiento: "Profilaxis / destartraje ultrasónico",
        contenido: consentimiento(
          "Consentimiento informado - Limpieza dental (profilaxis)",
          "destartraje supragingival y subgingival con ultrasonido e instrumental manual, pulido coronario con pasta profiláctica y aplicación tópica de flúor, orientado a remover placa bacteriana, cálculo dental y manchas externas para prevenir caries y enfermedad gingival.",
          "sensibilidad dentaria transitoria al frío, leve sangrado gingival durante y después del procedimiento (habitual cuando existe inflamación previa), molestias en encías retraídas o raíces expuestas y, en raras ocasiones, reacción alérgica a algún insumo utilizado; se informará sobre técnicas de higiene para mantener los resultados.",
        ),
        createdBy: uDuenia.id,
      },
    ]);

    // --- Servicios ----------------------------------------------------------
    const svcs = await tx
      .insert(schema.services)
      .values([
        { tenantId: team.id, nombre: "Evaluación dental", duracionMin: 20, bufferMin: 5, precio: "50.00", createdBy: uDuenia.id },
        { tenantId: team.id, nombre: "Limpieza dental", duracionMin: 45, bufferMin: 5, precio: "120.00", createdBy: uDuenia.id },
        { tenantId: team.id, nombre: "Resina simple", duracionMin: 45, bufferMin: 10, precio: "150.00", createdBy: uDuenia.id },
        { tenantId: team.id, nombre: "Endodoncia uniradicular", duracionMin: 60, bufferMin: 15, precio: "450.00", createdBy: uDuenia.id },
        { tenantId: team.id, nombre: "Exodoncia simple", duracionMin: 40, bufferMin: 15, precio: "200.00", createdBy: uDuenia.id },
        { tenantId: team.id, nombre: "Corona de porcelana", duracionMin: 90, bufferMin: 15, precio: "900.00", createdBy: uDuenia.id },
        { tenantId: team.id, nombre: "Ortodoncia brackets (mensual)", duracionMin: 30, bufferMin: 0, precio: "250.00", createdBy: uDuenia.id },
        { tenantId: team.id, nombre: "Blanqueamiento dental", duracionMin: 60, bufferMin: 10, precio: "400.00", createdBy: uDuenia.id },
        { tenantId: team.id, nombre: "Implante dental", duracionMin: 120, bufferMin: 30, precio: "2800.00", createdBy: uDuenia.id },
        { tenantId: team.id, nombre: "Profilaxis infantil", duracionMin: 30, bufferMin: 5, precio: "80.00", createdBy: uDuenia.id },
      ])
      .returning();
    const svcPorNombre = new Map(svcs.map((s) => [s.nombre, s]));
    const sEval = svcPorNombre.get("Evaluación dental")!;
    const sLimpieza = svcPorNombre.get("Limpieza dental")!;
    const sResina = svcPorNombre.get("Resina simple")!;
    const sEndo = svcPorNombre.get("Endodoncia uniradicular")!;
    const sExo = svcPorNombre.get("Exodoncia simple")!;
    const sOrto = svcPorNombre.get("Ortodoncia brackets (mensual)")!;

    // --- Sucursal principal -------------------------------------------------
    await tx.insert(schema.branches).values({
      tenantId: team.id,
      nombre: "Vitalia Central",
      slug: "central",
      direccion: "Av. Arequipa 2450, Lince, Lima",
      telefono: "01-5551234",
      activo: true,
    });

    // --- Pacientes (18; el último es menor de edad con representante) -------
    const patsRaw = [
      { nombre: "María Fernanda Quispe Torres", documento: "44218736", celular: "987654301", fnac: "1978-03-14" },
      { nombre: "Jorge Luis Huamán Ríos", documento: "45982104", celular: "987654302", fnac: "1985-07-22" },
      { nombre: "Rosa Amelia Ccahuana Mamani", documento: "09873451", celular: "987654303", fnac: "1968-11-02" },
      { nombre: "Carlos Alberto Flores Vásquez", documento: "47120938", celular: "987654304", fnac: "1990-01-30" },
      { nombre: "Luz Marina Sánchez Rojas", documento: "10239871", celular: "987654305", fnac: "1972-05-19" },
      { nombre: "Pedro Pablo Castillo Núñez", documento: "43029175", celular: "987654306", fnac: "1983-09-08" },
      { nombre: "Ana Lucía Ramírez Espinoza", documento: "48210937", celular: "987654307", fnac: "1995-12-11" },
      { nombre: "Julio César Vargas Paredes", documento: "08912376", celular: "987654308", fnac: "1965-04-27" },
      { nombre: "Carmen Rosa Aguilar Chávez", documento: "40982317", celular: "987654309", fnac: "1979-08-16" },
      { nombre: "Ricardo Manuel Salazar Cruz", documento: "46120984", celular: "987654310", fnac: "1988-02-05" },
      { nombre: "Patricia Elena Mendoza Quispe", documento: "47903218", celular: "987654311", fnac: "1993-06-21" },
      { nombre: "Fernando Armando Torres Lara", documento: "07812943", celular: "987654312", fnac: "1962-10-09" },
      { nombre: "Gabriela Sofía Herrera Delgado", documento: "49210837", celular: "987654313", fnac: "1997-01-18" },
      { nombre: "Víctor Hugo Ponce Cárdenas", documento: "10129873", celular: "987654314", fnac: "1974-12-03" },
      { nombre: "Silvia Beatriz Conde Villanueva", documento: "43821097", celular: "987654315", fnac: "1986-03-29" },
      { nombre: "Óscar Iván Chávez Rentería", documento: "48120379", celular: "987654316", fnac: "1991-07-07" },
      { nombre: "Norma Elsa Vilca Apaza", documento: "09378124", celular: "987654317", fnac: "1970-09-25" },
    ];
    const pats = await tx
      .insert(schema.patients)
      .values([
        ...patsRaw.map((p) => ({
          tenantId: team.id,
          nombre: p.nombre,
          documento: p.documento,
          celular: p.celular,
          email: `${p.nombre
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .split(" ")
            .slice(0, 2)
            .join(".")}@example.com`,
          fnac: p.fnac,
          createdBy: uRecepcion.id,
        })),
        {
          tenantId: team.id,
          nombre: "Sebastián Mateo León Guerra",
          documento: "71209384",
          celular: "987654318",
          email: "sebastian.leon@example.com",
          fnac: "2013-05-12",
          representanteId: null, // se completa debajo con su madre
          createdBy: uRecepcion.id,
        },
      ])
      .returning();
    const [p1, p2, p3, p4, p5, p11, p12, p13, p16, p17] = pats;
    const pMenor = pats[pats.length - 1]!;
    await tx
      .update(schema.patients)
      .set({ representanteId: p17!.id })
      .where(eq(schema.patients.id, pMenor.id));

    // --- Aseguradoras + coberturas activas (política ficticia en notas) -----
    const insurers = await tx
      .insert(schema.insurers)
      .values([
        { tenantId: team.id, nombre: "Rimac Seguros", ruc: "20411490001", telefono: "01-613-1000" },
        { tenantId: team.id, nombre: "Pacífico Salud", ruc: "20331135077", telefono: "01-513-5000" },
        { tenantId: team.id, nombre: "Mapfre Salud", ruc: "20418893167", telefono: "01-213-3333" },
        { tenantId: team.id, nombre: "Sanitas Perú", ruc: "20512345678", telefono: "01-611-0000" },
      ])
      .returning();

    await tx.insert(schema.patientCoverages).values([
      {
        patientId: p1!.id,
        insurerId: insurers[0]!.id,
        plan: "Rimac EPS Preferente",
        copagoPct: "20.00",
        vigenteDesde: fechaLima(-90),
        vigenteHasta: fechaLima(365),
        notas: "Política N° RM-88451203-P",
      },
      {
        patientId: p2!.id,
        insurerId: insurers[1]!.id,
        plan: "Pacífico Salud Vital",
        copagoPct: "30.00",
        vigenteDesde: fechaLima(-60),
        vigenteHasta: fechaLima(300),
        notas: "Política N° PS-55120874-A",
      },
      {
        patientId: p3!.id,
        insurerId: insurers[2]!.id,
        plan: "Mapfre Salud Total",
        copagoPct: "10.00",
        vigenteDesde: fechaLima(-120),
        vigenteHasta: fechaLima(240),
        notas: "Política N° MP-77341209-C",
      },
      {
        patientId: p4!.id,
        insurerId: insurers[3]!.id,
        plan: "Sanitas Básico Plus",
        copagoPct: "25.00",
        vigenteDesde: fechaLima(-30),
        vigenteHasta: fechaLima(330),
        notas: "Política N° SN-22091847-B",
      },
    ]);

    // --- Horarios L-V 9:00-19:00 con pausa almuerzo (clínicos) --------------
    const sched: Array<typeof schema.staffSchedules.$inferInsert> = [];
    for (const membershipId of [mCamila!.id, mAna!.id, mKevin!.id]) {
      for (const dow of [1, 2, 3, 4, 5]) {
        sched.push(
          { membershipId, dayOfWeek: dow, horaIni: "09:00", horaFin: "13:00" },
          { membershipId, dayOfWeek: dow, horaIni: "14:00", horaFin: "19:00" },
        );
      }
    }
    await tx.insert(schema.staffSchedules).values(sched);

    // --- Citas (~16 + 4 de la serie) ----------------------------------------
    type Appt = {
      fecha: string;
      ini: string;
      fin: string;
      estado: "atendida" | "no_show" | "cancelada" | "confirmada" | "solicitada";
      sala?: "anunciado" | null;
      svc: string;
      pat: string;
      doc: string | null;
      pref?: string | null;
      modo?: boolean;
      monto: string;
      pagado?: string;
      notas?: string | null;
    };
    const appts: Appt[] = [
      // Últimos 10 días: atendida ×4, no_show ×1, cancelada ×1
      { fecha: d1!, ini: "10:00", fin: "10:45", estado: "atendida", svc: sResina.id, pat: p2!.id, doc: mCamila!.id, monto: "150.00", pagado: "150.00" },
      { fecha: d2!, ini: "09:00", fin: "09:45", estado: "atendida", svc: sLimpieza.id, pat: p1!.id, doc: mAna!.id, monto: "120.00", pagado: "120.00" },
      { fecha: d3!, ini: "15:00", fin: "15:20", estado: "atendida", svc: sEval.id, pat: p3!.id, doc: mCamila!.id, monto: "50.00", pagado: "50.00" },
      { fecha: d4!, ini: "11:00", fin: "12:00", estado: "atendida", svc: sEndo.id, pat: p4!.id, doc: mAna!.id, monto: "450.00", pagado: "250.00", notas: "Primera sesión endodoncia pieza 21" },
      { fecha: d5!, ini: "16:00", fin: "17:00", estado: "no_show", svc: svcPorNombre.get("Blanqueamiento dental")!.id, pat: p5!.id, doc: mCamila!.id, monto: "400.00", notas: "No acudió; llamar para reprogramar" },
      { fecha: d6!, ini: "09:00", fin: "09:45", estado: "cancelada", svc: sLimpieza.id, pat: pats[5]!.id, doc: mAna!.id, monto: "120.00", notas: "Canceló por trabajo" },
      // Hoy: confirmadas ×4, 2 en sala de espera ('anunciado')
      { fecha: hoy, ini: "09:00", fin: "09:45", estado: "confirmada", sala: "anunciado", svc: sLimpieza.id, pat: pats[6]!.id, doc: mAna!.id, monto: "120.00" },
      { fecha: hoy, ini: "10:00", fin: "10:20", estado: "confirmada", svc: sEval.id, pat: pats[7]!.id, doc: mCamila!.id, monto: "50.00" },
      { fecha: hoy, ini: "11:00", fin: "11:45", estado: "confirmada", sala: "anunciado", svc: sResina.id, pat: pats[8]!.id, doc: mAna!.id, monto: "150.00" },
      { fecha: hoy, ini: "16:00", fin: "16:40", estado: "confirmada", svc: sExo.id, pat: pats[9]!.id, doc: mCamila!.id, monto: "200.00" },
      // Próximos 7 días: solicitada ×2, confirmada ×4
      { fecha: f1!, ini: "09:00", fin: "09:45", estado: "confirmada", svc: sLimpieza.id, pat: p11!.id, doc: mAna!.id, monto: "120.00" },
      { fecha: f1!, ini: "15:00", fin: "15:20", estado: "solicitada", modo: true, svc: sEval.id, pat: p12!.id, doc: null, pref: mAna!.id, monto: "50.00", notas: "Molestia al masticar del lado derecho" },
      { fecha: f2!, ini: "10:00", fin: "10:45", estado: "confirmada", svc: sResina.id, pat: p13!.id, doc: mCamila!.id, monto: "150.00" },
      { fecha: f3!, ini: "09:00", fin: "09:30", estado: "confirmada", svc: svcPorNombre.get("Profilaxis infantil")!.id, pat: pMenor.id, doc: mAna!.id, monto: "80.00", notas: "Acude con su representante" },
      { fecha: f4!, ini: "11:00", fin: "11:20", estado: "solicitada", modo: true, svc: sEval.id, pat: pats[13]!.id, doc: null, pref: mCamila!.id, monto: "50.00", notas: "Primera consulta" },
      { fecha: f4!, ini: "16:00", fin: "16:40", estado: "confirmada", svc: sExo.id, pat: pats[14]!.id, doc: mAna!.id, monto: "200.00" },
    ];

    const citasInsertadas = await tx
      .insert(schema.appointments)
      .values(
        appts.map((a) => ({
          tenantId: team.id,
          serviceId: a.svc,
          patientId: a.pat,
          doctorId: a.doc,
          preferredDoctorId: a.pref ?? a.doc,
          fecha: a.fecha,
          horaIni: a.ini,
          horaFin: a.fin,
          estado: a.estado,
          salaEstado: a.sala ?? null,
          currentStatusSince: a.sala ? new Date() : null,
          modoSolicitud: a.modo ?? false,
          monto: a.monto,
          montoPagado: a.pagado ?? "0.00",
          notas: a.notas ?? null,
          createdBy: uRecepcion.id,
        })),
      )
      .returning({ id: schema.appointments.id, fecha: schema.appointments.fecha });

    // Serie semanal ×4 de ortodoncia (paciente p16) + sus citas futuras
    const serieInicio = primerHabilDesde(7);
    const [serie] = await tx
      .insert(schema.appointmentSeries)
      .values({
        tenantId: team.id,
        patientId: p16!.id,
        serviceId: sOrto.id,
        doctorId: mAna!.id,
        titulo: "Ortodoncia brackets - ajuste mensual",
        frecuencia: "semanal",
        horaIni: "18:00",
        totalSesiones: 4,
        creadas: 4,
        estado: "activa",
        createdBy: uRecepcion.id,
      })
      .returning({ id: schema.appointmentSeries.id });

    const seriesCitas: Array<{ id: string }> = [];
    for (let n = 1; n <= 4; n++) {
      const fechaN = n === 1 ? serieInicio : sumarDias(serieInicio, (n - 1) * 7);
      const [cita] = await tx
        .insert(schema.appointments)
        .values({
          tenantId: team.id,
          serviceId: sOrto.id,
          patientId: p16!.id,
          doctorId: mAna!.id,
          preferredDoctorId: mAna!.id,
          fecha: fechaN,
          horaIni: "18:00",
          horaFin: "18:30",
          estado: "confirmada",
          modoSolicitud: false,
          monto: sOrto.precio,
          seriesId: serie!.id,
          seriesN: n,
          createdBy: uRecepcion.id,
        })
        .returning({ id: schema.appointments.id });
      seriesCitas.push(cita!);
    }

    // --- Historia clínica de las citas atendidas ----------------------------
    // citasInsertadas[i] corresponde a appts[i] (mismo orden del insert múltiple).
    const citaIdDe = (fecha: string, pat: string): string | undefined => {
      const i = appts.findIndex((a) => a.fecha === fecha && a.pat === pat);
      return i >= 0 ? citasInsertadas[i]?.id : undefined;
    };

    await tx.insert(schema.clinicalRecords).values([
      {
        patientId: p2!.id,
        appointmentId: citaIdDe(d1!, p2!.id),
        nota:
          "Restauración con resina en pieza 36 (oclusal). Anestesia local articaína 4% 1:100000, aislamiento relativo, remoción de caries, grabado ácido 30 s, adhesivo universal y resina nanohíbrida tono A2 fotocurada 40 s. Oclusión verificada con papel articulante. Indicaciones: evitar alimentos duros 2 h, control en 6 meses.",
        adjuntos: null,
        createdBy: uDuenia.id,
      },
      {
        patientId: p1!.id,
        appointmentId: citaIdDe(d2!, p1!.id),
        nota:
          "Profilaxis: destartraje supragingival con ultrasonido en los cuatro cuadrantes, pulido con pasta profiláctica y aplicación tópica de flúor al 5%. Gingivitis generalizada leve; se refuerza técnica de cepillado y uso de hilo dental. Control en 6 meses.",
        adjuntos: null,
        createdBy: uAna.id,
      },
      {
        patientId: p3!.id,
        appointmentId: citaIdDe(d3!, p3!.id),
        nota:
          "Evaluación inicial completa: se registran caries oclusales activas en sector posterior y cálculo moderado. Se planifica limpieza + restauraciones por fases. Se solicita radiografía periapical de control. Sin antecedentes médico-quirúrgicos de relevancia.",
        adjuntos: null,
        createdBy: uDuenia.id,
      },
      {
        patientId: p4!.id,
        appointmentId: citaIdDe(d4!, p4!.id),
        nota:
          "Endodoncia uniradicular pieza 21: apertura cameral bajo anestesia local, aislamiento absoluto, conductometría electrónica y radiográfica (19 mm), instrumentación rotaria hasta #25.04, irrigación con hipoclorito 5% y EDTA, obturación con gutapercha por condensación lateral. Control radiográfico en 6 meses; se indica corona definitiva.",
        adjuntos: null,
        createdBy: uAna.id,
      },
    ]);

    // --- Odontograma: tooth_states + charts (status y plan) -----------------
    const odontogramas: Array<{ patientId: string; estados: Array<typeof schema.toothStates.$inferInsert>; chart: object; planChart: object | null }> = [
      {
        patientId: p1!.id,
        estados: [
          { patientId: p1!.id, toothFdi: 16, estado: "cariado", nota: "Caries oclusal profunda", updatedBy: uDuenia.id },
          { patientId: p1!.id, toothFdi: 26, estado: "cariado", nota: "Caries mesial incipiente", updatedBy: uDuenia.id },
        ],
        chart: chartJson({
          "16": toothCariado("occlusal", 3),
          "26": toothCariado("mesial", 2),
        }),
        planChart: chartJson({
          "16": toothRestaurado("occlusal"),
          "26": toothRestaurado("mesial"),
        }),
      },
      {
        patientId: p2!.id,
        estados: [
          { patientId: p2!.id, toothFdi: 36, estado: "tratado", nota: "Restauración resina oclusal", updatedBy: uDuenia.id },
        ],
        chart: chartJson({
          "36": toothRestaurado("occlusal"),
        }),
        planChart: null,
      },
      {
        patientId: p4!.id,
        estados: [
          { patientId: p4!.id, toothFdi: 48, estado: "cariado", nota: "Exodoncia indicada (tercer molar)", updatedBy: uAna.id },
        ],
        chart: chartJson({
          "48": toothExodonciaIndicada(),
        }),
        planChart: chartJson({
          "48": toothExodonciaIndicada(),
        }),
      },
      {
        patientId: p12!.id,
        estados: [
          { patientId: p12!.id, toothFdi: 46, estado: "corona", nota: "Corona metal-porcelana", updatedBy: uAna.id },
        ],
        chart: chartJson({
          "46": toothCorona(),
        }),
        planChart: null,
      },
    ];
    for (const o of odontogramas) {
      await tx.insert(schema.toothStates).values(o.estados);
      await tx.insert(schema.odontogramCharts).values({
        tenantId: team.id,
        patientId: o.patientId,
        status: o.chart,
        plan: o.planChart,
        version: "2.20",
        updatedBy: uDuenia.id,
      });
    }

    // Periodontograma básico (snapshot) para 1 paciente
    await tx.insert(schema.perioRecords).values({
      tenantId: team.id,
      patientId: p5!.id,
      snapshot: perioSnapshot(),
      nota: "Sondaje inicial: gingivitis generalizada leve, sin pérdida de inserción. BOP localizado.",
      savedBy: uAna.id,
    });

    // --- Pagos históricos (12, últimos 15 días, sin receipts) ---------------
    const hace = (dias: number) => new Date(Date.now() - dias * 86_400_000);

    const pagosFilas: Array<typeof schema.payments.$inferInsert> = [
      { tenantId: team.id, patientId: p2!.id, monto: "150.00", metodo: "yape", referencia: "YAPE-104512", registradoPor: uRecepcion.id, createdAt: hace(2) },
      // Cuota 1 del presupuesto aprobado (se vincula abajo a installments)
      { tenantId: team.id, patientId: p1!.id, monto: "250.00", metodo: "yape", referencia: "YAPE-ORTO-0118", registradoPor: uRecepcion.id, createdAt: hace(3) },
      { tenantId: team.id, patientId: p1!.id, monto: "120.00", metodo: "efectivo", referencia: null, registradoPor: uRecepcion.id, createdAt: hace(3) },
      { tenantId: team.id, patientId: p3!.id, monto: "50.00", metodo: "plin", referencia: "PLIN-339128", registradoPor: uRecepcion.id, createdAt: hace(4) },
      { tenantId: team.id, patientId: p4!.id, monto: "250.00", metodo: "tarjeta_pos", referencia: "POS-007211", registradoPor: uRecepcion.id, createdAt: hace(5) },
      { tenantId: team.id, patientId: p1!.id, monto: "100.00", metodo: "yape", referencia: "Adelanto", registradoPor: uRecepcion.id, createdAt: hace(6) },
      { tenantId: team.id, patientId: null, monto: "80.00", metodo: "efectivo", referencia: null, registradoPor: uRecepcion.id, createdAt: hace(7) },
      { tenantId: team.id, patientId: pats[6]!.id, monto: "250.00", metodo: "tarjeta_online", referencia: "TON-991284", registradoPor: uRecepcion.id, createdAt: hace(9) },
      { tenantId: team.id, patientId: pats[8]!.id, monto: "150.00", metodo: "plin", referencia: "PLIN-554019", registradoPor: uRecepcion.id, createdAt: hace(10) },
      { tenantId: team.id, patientId: pats[9]!.id, monto: "100.00", metodo: "tarjeta_pos", referencia: "POS-007355", registradoPor: uRecepcion.id, createdAt: hace(12) },
      { tenantId: team.id, patientId: p5!.id, monto: "150.00", metodo: "efectivo", referencia: "Adelanto", registradoPor: uRecepcion.id, createdAt: hace(14) },
      { tenantId: team.id, patientId: null, monto: "60.00", metodo: "efectivo", referencia: null, registradoPor: uRecepcion.id, createdAt: hace(15) },
    ];
    const pagos = await tx.insert(schema.payments).values(pagosFilas).returning({ id: schema.payments.id });
    const pagoCuota1 = pagos[1]!.id;

    // --- Presupuestos: borrador, enviado y aprobado (+cuotas +plan) ---------
    const mkItem = (nombre: string, cantidad: number) => {
      const s = svcPorNombre.get(nombre)!;
      return { servicioId: s.id, descripcion: s.nombre, cantidad, precioUnitario: Number(s.precio) };
    };

    const quotesCreados = await tx
      .insert(schema.quotes)
      .values([
        {
          tenantId: team.id,
          patientId: p3!.id,
          doctorId: mCamila!.id,
          titulo: "Plan de rehabilitación por fases",
          items: [mkItem("Corona de porcelana", 1), mkItem("Evaluación dental", 1)],
          total: "950.00",
          estado: "borrador",
          nota: "Pendiente confirmar tono con laboratorio",
          createdBy: uDuenia.id,
        },
        {
          tenantId: team.id,
          patientId: p5!.id,
          doctorId: mCamila!.id,
          titulo: "Blanqueamiento + limpieza",
          items: [mkItem("Blanqueamiento dental", 1), mkItem("Limpieza dental", 1)],
          total: "520.00",
          estado: "enviado",
          expiraEn: fechaLima(30),
          createdBy: uDuenia.id,
        },
        {
          tenantId: team.id,
          patientId: p1!.id,
          doctorId: mAna!.id,
          titulo: "Ortodoncia brackets - tratamiento integral",
          items: [mkItem("Ortodoncia brackets (mensual)", 3)],
          total: "750.00",
          estado: "aprobado",
          acceptedVia: "clinica",
          acceptedAt: new Date(),
          expiraEn: fechaLima(30),
          createdBy: uDuenia.id,
        },
      ])
      .returning({ id: schema.quotes.id, estado: schema.quotes.estado });
    const quoteAprobado = quotesCreados.find((q) => q.estado === "aprobado")!;

    // Cuotas 1..3 del aprobado (misma mecánica que POST /api/presupuestos/[id]/cuotas):
    // monto parejo salvo redondeo en la última; vence cada 30 días; cuota 1 pagada.
    const totalCent = Math.round(Number("750.00") * 100);
    const nCuotas = 3;
    const cuotaCent = Math.floor(totalCent / nCuotas);
    await tx.insert(schema.installments).values(
      Array.from({ length: nCuotas }, (_, i) => {
        const esUltima = i === nCuotas - 1;
        const montoCent = esUltima ? totalCent - cuotaCent * (nCuotas - 1) : cuotaCent;
        const monto = (montoCent / 100).toFixed(2);
        return i === 0
          ? {
              tenantId: team.id,
              patientId: p1!.id,
              quoteId: quoteAprobado.id,
              concepto: "Ortodoncia brackets - tratamiento integral",
              n: 1,
              monto,
              pagado: monto,
              vence: fechaLima(30),
              estado: "pagada" as const,
              paymentId: pagoCuota1,
            }
          : {
              tenantId: team.id,
              patientId: p1!.id,
              quoteId: quoteAprobado.id,
              concepto: "Ortodoncia brackets - tratamiento integral",
              n: i + 1,
              monto,
              pagado: "0.00",
              vence: fechaLima(30 * (i + 1)),
              estado: "pendiente" as const,
            };
      }),
    );

    // Plan de tratamiento asociado al aprobado
    const anio = new Date().getFullYear();
    const [planAprobado] = await tx
      .insert(schema.treatmentPlans)
      .values({
        tenantId: team.id,
        patientId: p1!.id,
        planNumber: `PLAN-${anio}-0001`,
        titulo: "Ortodoncia brackets - tratamiento integral",
        estado: "active",
        budgetId: quoteAprobado.id,
        assignedDoctorId: mAna!.id,
        confirmedAt: new Date(),
        createdBy: uDuenia.id,
      })
      .returning({ id: schema.treatmentPlans.id });

    const planItemsData = [sOrto, sLimpieza];
    const planItems = await tx
      .insert(schema.treatmentPlanItems)
      .values(
        planItemsData.map((s, i) => ({
          tenantId: team.id,
          planId: planAprobado!.id,
          serviceId: s.id,
          secuencia: i + 1,
          estado: (i === 0 ? "in_progress" : "pending") as "in_progress" | "pending",
          snapshotServicio: { nombre: s.nombre, precio: s.precio, duracionMin: s.duracionMin },
        })),
      )
      .returning({ id: schema.treatmentPlanItems.id });

    await tx.insert(schema.treatmentPlanSessions).values([
      {
        tenantId: team.id,
        itemId: planItems[0]!.id,
        sessionN: 1,
        appointmentId: seriesCitas[0]?.id ?? null,
        estado: "programada",
        notas: "Primera sesión: colocación de brackets arco superior",
      },
      {
        tenantId: team.id,
        itemId: planItems[1]!.id,
        sessionN: 1,
        appointmentId: null,
        estado: "programada",
        notas: "Limpieza previa al inicio de ortodoncia",
      },
    ]);

    // --- Inventario: items + lotes + kardex + recetas -----------------------
    const inventarioSpec = [
      { nombre: "Guantes de nitrilo M (caja x100)", categoria: "insumos", unidad: "caja", stock: "24.00", stockMin: "5.00", costoUnit: "18.50", lote: "GN-2601", vence: 365, ingreso: "26.00", consumo: "2.00" },
      { nombre: "Mascarillas KN95 (caja x20)", categoria: "insumos", unidad: "caja", stock: "15.00", stockMin: "4.00", costoUnit: "25.00", lote: "KN95-2603", vence: 400, ingreso: "16.00", consumo: "1.00" },
      { nombre: "Anestésico lidocaína 2% (frasco)", categoria: "anestesia", unidad: "frasco", stock: "12.00", stockMin: "3.00", costoUnit: "22.00", lote: "LIDO-2609", vence: 300, ingreso: "12.00", consumo: null },
      { nombre: "Composite A2 (jeringa)", categoria: "materiales", unidad: "jeringa", stock: "8.00", stockMin: "2.00", costoUnit: "45.00", lote: "CMP-A2-112", vence: 540, ingreso: "9.00", consumo: "1.00" },
      { nombre: "Fresas diamantadas kit", categoria: "materiales", unidad: "kit", stock: "6.00", stockMin: "2.00", costoUnit: "85.00", lote: "FRZ-0042", vence: null, ingreso: "6.00", consumo: null },
      { nombre: "Alcohol gel 70% (litro)", categoria: "insumos", unidad: "litro", stock: "10.00", stockMin: "3.00", costoUnit: "12.00", lote: "AG-2618", vence: 500, ingreso: "10.00", consumo: null },
    ] as const;

    const itemIds = new Map<string, string>();
    for (const p of inventarioSpec) {
      const [item] = await tx
        .insert(schema.inventoryItems)
        .values({
          tenantId: team.id,
          nombre: p.nombre,
          categoria: p.categoria,
          unidad: p.unidad,
          stock: p.stock,
          stockMin: p.stockMin,
          costoUnit: p.costoUnit,
        })
        .returning({ id: schema.inventoryItems.id });
      itemIds.set(p.nombre, item!.id);

      await tx.insert(schema.inventoryLots).values({
        itemId: item!.id,
        lote: p.lote,
        vence: p.vence !== null ? fechaLima(p.vence) : null,
        cantidad: p.stock,
      });

      const movimientos: Array<typeof schema.stockMovements.$inferInsert> = [
        {
          tenantId: team.id,
          itemId: item!.id,
          tipo: "ingreso",
          cantidad: p.ingreso,
          nota: "Inventario inicial (piloto)",
          createdBy: uRecepcion.id,
        },
      ];
      if (p.consumo !== null) {
        movimientos.push({
          tenantId: team.id,
          itemId: item!.id,
          tipo: "consumo",
          cantidad: p.consumo,
          nota: "Consumo en atención",
          createdBy: uKevin.id,
        });
      }
      await tx.insert(schema.stockMovements).values(movimientos);
    }

    await tx.insert(schema.serviceMaterials).values([
      { serviceId: sLimpieza.id, itemId: itemIds.get("Guantes de nitrilo M (caja x100)")!, cantidad: "1.00" },
      { serviceId: sLimpieza.id, itemId: itemIds.get("Mascarillas KN95 (caja x20)")!, cantidad: "1.00" },
      { serviceId: sResina.id, itemId: itemIds.get("Guantes de nitrilo M (caja x100)")!, cantidad: "1.00" },
      { serviceId: sResina.id, itemId: itemIds.get("Composite A2 (jeringa)")!, cantidad: "1.00" },
    ]);

    // --- Waitlist + bloqueo de agenda --------------------------------------
    await tx.insert(schema.waitlists).values([
      {
        tenantId: team.id,
        patientId: p11!.id,
        serviceId: sLimpieza.id,
        preferencia: "Tarde (luego de las 17:00)",
        prioridad: 3,
        estado: "activa",
      },
      {
        tenantId: team.id,
        patientId: p13!.id,
        serviceId: sResina.id,
        preferencia: "Mañana (antes de las 11:00)",
        prioridad: 5,
        estado: "activa",
      },
    ]);

    await tx.insert(schema.blockedSlots).values({
      tenantId: team.id,
      doctorId: null,
      fecha: manana,
      horaIni: "14:00",
      horaFin: "15:30",
      motivo: "Capacitación",
    });

    // --- Resumen -------------------------------------------------------------
    console.table([
      { entidad: "usuarios+memberships", creados: members.length },
      { entidad: "suscripciones", creados: 1 },
      { entidad: "settings (notif/legal/fiscal/whatsapp)", creados: 4 },
      { entidad: "consent_templates", creados: 4 },
      { entidad: "servicios", creados: svcs.length },
      { entidad: "sucursales", creados: 1 },
      { entidad: "pacientes", creados: pats.length },
      { entidad: "aseguradoras", creados: insurers.length },
      { entidad: "coberturas", creados: 4 },
      { entidad: "horarios (bloques L-V)", creados: sched.length },
      { entidad: "citas", creados: citasInsertadas.length + seriesCitas.length },
      { entidad: "series", creados: 1 },
      { entidad: "historias_clinicas", creados: 4 },
      { entidad: "odontogram_charts + tooth_states", creados: odontogramas.length * 2 },
      { entidad: "periodontogramas", creados: 1 },
      { entidad: "pagos", creados: pagos.length },
      { entidad: "presupuestos", creados: quotesCreados.length },
      { entidad: "cuotas", creados: nCuotas },
      { entidad: "planes_tratamiento", creados: 1 },
      { entidad: "items_inventario", creados: inventarioSpec.length },
      { entidad: "waitlists", creados: 2 },
      { entidad: "bloqueos_agenda", creados: 1 },
    ]);

    console.log(`Seed piloto aplicado OK: ${team.name} (${team.slug})`);
    console.log(`Acceso piloto (password: ${PILOTO_PASSWORD}):`);
    console.log("  duena@vitalia.pe       (Dueña - Dra. Camila Rojas)");
    console.log("  recepcion@vitalia.pe   (Recepción - Luis Campos)");
    console.log("  odontologia@vitalia.pe (Odontóloga - Dra. Ana Valdéz)");
    console.log("  asistente@vitalia.pe   (Asistente - Kevin Soto)");
  });
}

async function main() {
  connect();
  await run();
  if (client) await client.end();
}

main().catch((e) => {
  console.error(e);
  if (client) void client.end({ timeout: 1 }).catch(() => {});
  process.exit(1);
});
