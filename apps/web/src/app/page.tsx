import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarDays,
  Inbox,
  Wallet,
  Users,
  ArrowRight,
  Sparkles,
  LogIn,
  Globe,
  BellRing,
  MonitorSmartphone,
  FileText,
  Smartphone,
  Check,
  ShieldCheck,
  ChevronDown,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Odontoflow — Gestión para consultorios odontológicos en Perú",
  description:
    "Agenda, reservas en línea, recordatorios automáticos, caja Yape/Plin y facturación SUNAT en un solo sistema. Prueba 15 días el plan Pro gratis, sin tarjeta.",
  openGraph: {
    title: "Odontoflow — Tu consultorio, sin hojas de cálculo",
    description:
      "Reservas 24/7, recordatorios que reducen ausencias, caja y facturación SUNAT. Hecho para consultorios odontológicos en Perú.",
    type: "website",
    locale: "es_PE",
    url: "/",
    siteName: "Odontoflow",
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "Odontoflow — gestión para consultorios odontológicos" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Odontoflow — Tu consultorio, sin hojas de cálculo",
    description:
      "Reservas 24/7, recordatorios automáticos, caja y SUNAT. Prueba 15 días el plan Pro gratis.",
    images: ["/og.jpg"],
  },
};

// Dinámica a propósito: los textos del trial dependen de TRIAL_DAYS, que es
// env de runtime del contenedor (no llega al build de la imagen).
export const dynamic = "force-dynamic";

const TRIAL = Number(process.env.TRIAL_DAYS ?? "0");
const TEXTO_TRIAL =
  TRIAL > 0 ? `Prueba ${TRIAL} días de Pro gratis · Sin tarjeta` : null;

const modulos = [
  {
    icon: CalendarDays,
    titulo: "Agenda que se maneja sola",
    desc: "Vista día, semana y mes. Citas por doctor, reprogramación en dos clics y horarios que los pacientes ven libres en tiempo real.",
  },
  {
    icon: Globe,
    titulo: "Reservas en línea 24/7",
    desc: "Cada clínica tiene su propia página pública: el paciente elige servicio, doctor y hora desde su celular. Tú confirmas o rechazas desde la consola.",
  },
  {
    icon: BellRing,
    titulo: "Recordatorios automáticos",
    desc: "Confirmaciones por email y recordatorio 24 h antes de cada cita, por correo o WhatsApp. Menos ausencias sin llamar a nadie.",
  },
  {
    icon: Inbox,
    titulo: "Sala de espera en vivo",
    desc: "Tablero interno: llegó → en box → atendida. Los pacientes se anuncian solos y toda la pantalla del consultorio se actualiza al instante.",
  },
  {
    icon: Wallet,
    titulo: "Caja con Yape, Plin y POS",
    desc: "Pagos QR con conciliación, cierre de caja diario y totales por método de pago. Sabes exactamente cuánto entró hoy.",
  },
  {
    icon: Users,
    titulo: "Ficha clínica completa",
    desc: "Odontograma profesional por superficies, periodontograma, notas clínicas, adjuntos y consentimientos firmados digitalmente.",
  },
  {
    icon: Smartphone,
    titulo: "Portal del paciente",
    desc: "El paciente ve sus citas, cuotas y comprobantes, paga por QR y confirma asistencia con un enlace. Sin instalar nada.",
  },
  {
    icon: FileText,
    titulo: "Facturación electrónica SUNAT",
    desc: "Boletas y facturas electrónicas emitidas al momento, con envío a SUNAT y reintentos automáticos. Export mensual incluido.",
  },
];

const planes = [
  {
    nombre: "Free",
    precio: "S/ 0",
    detalle: "Para empezar hoy",
    incluye: [
      "Página pública de reservas",
      "Agenda del día",
      "Cola de solicitudes",
      "Sala de espera y personal",
      "Ficha básica: odontograma y notas",
    ],
    cta: "Empezar gratis",
  },
  {
    nombre: "Pro",
    precio: "S/ 79",
    detalle: "El más elegido por clínicas que crecen",
    destacado: true,
    incluye: [
      "Todo lo de Free",
      "Recordatorios email/WhatsApp",
      "Ficha avanzada: laboratorio, fotos, seguros",
      "Recall y campañas",
      "Dashboard de ingresos",
    ],
    cta: `Probar Pro ${TRIAL > 0 ? `${TRIAL} días gratis` : "gratis"}`,
  },
  {
    nombre: "Premium",
    precio: "S/ 149",
    detalle: "Clínica consolidada",
    incluye: [
      "Todo lo de Pro",
      "Caja Yape/Plin/POS + cierre",
      "Facturación electrónica SUNAT",
      "Inventario con kardex",
      "Presupuestos y comisiones",
    ],
    cta: "Ver Premium",
  },
];

const faqs = [
  {
    q: "¿Necesito tarjeta para empezar?",
    a: `No. Creas tu consultorio en minutos y ${
      TRIAL > 0 ? `pruebas el plan Pro ${TRIAL} días sin ingresar ningún dato de pago.` : "empiezas gratis sin ningún dato de pago."
    }`,
  },
  {
    q: "¿Qué pasa cuando termina la prueba?",
    a: "Tu cuenta pasa automáticamente al plan Free y conservas todos tus datos: pacientes, citas e historial no se borran nunca. Solo se desactivan los módulos avanzados hasta que decidas pasar a un plan pago.",
  },
  {
    q: "¿Están seguros los datos de mis pacientes?",
    a: "Sí. Cada consultorio es un espacio privado e independiente, los accesos son por roles y hay respaldo diario automático de la base de datos. Cumplimos con las buenas prácticas de protección de datos personales (Ley 29733).",
  },
  {
    q: "¿Sirve si soy un dentista solo, sin personal?",
    a: "Sí, y de hecho es donde más se nota: reservas solas, recordatorios solos y la caja cuadra al final del día. Cuando crezcas agregas recepción, doctores y asistentes con permisos separados.",
  },
  {
    q: "¿Emito comprobantes electrónicos reales?",
    a: "En el plan Premium: boletas y facturas electrónicas enviadas a SUNAT con reintento automático y export mensual para tu contador.",
  },
  {
    q: "¿Lo uso desde el celular?",
    a: "Odontoflow se instala como app en tu celular (iPhone y Android) desde el navegador. Agenda, sala de espera y ficha funcionan en pantalla táctil.",
  },
];

function HeaderLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground md:inline-flex"
    >
      {children}
    </a>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-white">
              <Sparkles className="size-4" />
            </span>
            <span className="text-[15px] font-bold tracking-tight">odontoflow</span>
          </div>
          <nav className="flex items-center gap-6">
            <HeaderLink href="#funciones">Funciones</HeaderLink>
            <HeaderLink href="#precios">Precios</HeaderLink>
            <HeaderLink href="#preguntas">Preguntas</HeaderLink>
            <Link
              href="/login"
              className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <LogIn className="size-4" />
              Iniciar sesión
            </Link>
            <Link
              href="/signup"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Crear mi consultorio
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4">
        {/* HERO */}
        <section className="mx-auto max-w-3xl py-16 text-center sm:py-24">
          {TEXTO_TRIAL ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-accent px-4 py-1.5 text-xs font-semibold text-primary">
              <Sparkles className="size-3.5" />
              {TEXTO_TRIAL}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-accent px-4 py-1.5 text-xs font-medium text-accent-foreground">
              Tu propia clínica en minutos
            </span>
          )}
          <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight sm:text-5xl sm:leading-tight">
            Deja de administrar tu consultorio
            <br />
            con <span className="text-primary">cuadernos y WhatsApp</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
            Los pacientes reservan solos desde tu página, reciben recordatorios
            automáticos y dejan de no aparecer. La caja cuadra al final del día
            y tus comprobantes salen a SUNAT sin pensar en ello.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md"
            >
              Crear mi consultorio gratis
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-lg border bg-card px-6 py-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              Ya tengo cuenta
            </Link>
          </div>
          <p className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Check className="size-3.5 text-primary" /> Hecho para Perú
            </span>
            <span className="inline-flex items-center gap-1">
              <ShieldCheck className="size-3.5 text-primary" /> Respaldos diarios
            </span>
            <span className="inline-flex items-center gap-1">
              <MonitorSmartphone className="size-3.5 text-primary" /> Instalable en tu celular
            </span>
          </p>
        </section>

        {/* FUNCIONES */}
        <section id="funciones" className="scroll-mt-20 pb-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Todo lo que pasa en tu consultorio, en un solo lugar
            </h2>
            <p className="mt-3 text-sm text-muted-foreground sm:text-base">
              De la solicitud de cita hasta el comprobante electrónico, sin
              copiar datos entre apps.
            </p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {modulos.map((m) => (
              <div
                key={m.titulo}
                className="rounded-xl border bg-card p-5 transition-shadow hover:shadow-md"
              >
                <span className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <m.icon className="size-5" />
                </span>
                <h3 className="mt-4 text-sm font-semibold">{m.titulo}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {m.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* PRECIOS */}
        <section id="precios" className="scroll-mt-20 pb-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Precios simples, sin sorpresas
            </h2>
            <p className="mt-3 text-sm text-muted-foreground sm:text-base">
              {TRIAL > 0
                ? `Empieza con ${TRIAL} días de Pro gratis. Si te convence, sigues desde S/ 79 al mes; si no, te quedas en Free para siempre.`
                : "Empieza gratis y sube de plan cuando tu consultorio crezca."}
            </p>
          </div>
          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
            {planes.map((p) => (
              <div
                key={p.nombre}
                className={`relative flex flex-col rounded-2xl border p-6 ${
                  p.destacado ? "border-primary shadow-md" : "bg-card"
                }`}
              >
                {"destacado" in p && p.destacado && TRIAL > 0 ? (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-white">
                    {TRIAL} días gratis
                  </span>
                ) : null}
                <p className="text-sm font-semibold">{p.nombre}</p>
                <p className="mt-3 text-3xl font-semibold tabular-nums tracking-tight">
                  {p.precio}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">/mes</span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{p.detalle}</p>
                <ul className="mt-5 flex-1 space-y-2.5">
                  {p.incluye.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span className="text-muted-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/signup"
                  className={`mt-6 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                    p.destacado
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "border bg-card hover:bg-accent"
                  }`}
                >
                  {p.cta}
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            ))}
          </div>
          <p className="mx-auto mt-6 max-w-xl text-center text-xs text-muted-foreground">
            El cobro es directo por Yape, Plin o transferencia. Sin contratos ni
            penalidades: cancelas cuando quieras.
          </p>
        </section>

        {/* FAQ */}
        <section id="preguntas" className="mx-auto max-w-2xl scroll-mt-20 pb-24">
          <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
            Preguntas frecuentes
          </h2>
          <div className="mt-8 space-y-3">
            {faqs.map((f) => (
              <details key={f.q} className="group rounded-xl border bg-card">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4 text-sm font-medium [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <p className="px-4 pb-4 text-sm leading-relaxed text-muted-foreground">
                  {f.a}
                </p>
              </details>
            ))}
          </div>
        </section>

        {/* CTA FINAL */}
        <section className="pb-24">
          <div className="rounded-2xl border border-primary/30 bg-accent px-6 py-12 text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Tu próximo paciente puede estar reservando ahora mismo
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground">
              Crea tu consultorio, comparte el link de tu página de reservas y
              deja que la agenda trabaje mientras atiendes.
            </p>
            <Link
              href="/signup"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md"
            >
              Crear mi consultorio gratis
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 text-sm text-muted-foreground sm:flex-row sm:justify-between">
          <p>© 2026 Odontoflow · SaaS para consultorios odontológicos en Perú</p>
          <div className="flex gap-4">
            <Link href="/login" className="hover:text-foreground">Iniciar sesión</Link>
            <Link href="/signup" className="hover:text-foreground">Registrarse</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
