# Roadmap

Regla: feature freeze tras M3. Solo ship → vender → medir antes de construir más.

## M0 — Fundaciones (semana 1)
- [x] Persistir plan en docs/
- [x] Monorepo npm workspaces: apps/web + packages/{ui,core,db}
- [x] Design system base (tokens teal, tailwind config)
- [x] Core: dominio (roles, permisos, estados de cita, enums)
- [x] Web: esqueleto Next.js con layouts por rol
- [x] DB: schema multi-tenant (tenant_id en todo)
- [x] Integrar BoxyHQ saas-starter-kit como motor headless (tenants/memberships/roles/invitaciones)
- [x] Deploy Heroku + Postgres + dominio custom (SSL)
- [x] Landing estática (Netlify/Vercel)
- [x] CI/CD + lint/typecheck (lint ESLint + tests node:test en packages/core)

**Salida:** app.<dominio> viva, demo end-to-end grabable.

## M1 — Reservas públicas (semana 2-4)
- [x] Página pública r.<dominio>/<clinica>: wizard 3 pasos (servicio → fecha/franja + doctor preferencia → datos + consentimiento)
- [x] Motor de slots (disponibilidad, buffers, franjas) — core
- [x] Estados: solicitada → pendiente de confirmación
- [x] Link mágico del paciente (reprogramar/cancelar, sin cuenta)
- [x] Cola de "Solicitudes de cita" para recepción (aprobar/asignar doctor+hora exacta)
- [x] Confirmación por email/SMS con hora exacta

**Salida:** demo end-to-end reservando.

## M2 — Consola multirol + clínica (semana 5-8)
- [x] RBAC server-side: owner/receptionist/assistant/doctor
- [x] Vistas por rol y dispositivo: recepción (PC densa), doctor/asistente (móvil cards)
- [x] Ficha clínica: datos, antecedentes, alergias, intake médico
- [x] Odontograma FDI interactivo (estados por diente)
- [x] Adjuntos Rx desde celular (asistente)
- [x] Tablero sala de espera en tiempo real (check-in → móvil de doctor/asistente)
- [x] Reversibilidad/deshacer en citas (confirmada→solicitada, deshacer check-in/llamado, no_show→confirmada) con toast "Deshacer" 5s en sala de espera
- [x] Drag & drop en agenda día (reprogramar hora/arrastrar entre doctores, solo solicitada/confirmada)
- [x] Consentimientos firmados en pantalla (canvas → PDF)
- [x] Dedupe pacientes (celular/DNI/nombre)
- [x] Schedules de turno + restricción opcional fuera de horario
- [x] Audit log

**Salida:** 3 clínicas piloto usándolo a diario.

## M3 — Caja + cobros + dashboard (semana 9-10)
- [x] Caja: registro manual Yape/Plin/efectivo/tarjeta POS
- [x] Cierre diario + conciliación (contado vs referenciado vs POS)
- [x] Anulación contable de pagos (motivo ≥3, comisiones→0, cuotas→pendiente, exclusión de totales)
- [x] Reapertura de cierre diario (solo owner, motivo) + cierre nuevo tras corrección
- [x] Dashboard de ganancias del dueño (por doctor/servicio/método, no-shows, ocupación)
- [x] Registro manual de comprobantes (nº boleta, correlativo) + vat_settings modo manual
- [x] Planes manuales: panel admin activa flags + vencimientos + recordatorios de renovación
- [x] **Primer pago real (Yape/Plin directo a nosotros)** — manual concierge

**Salida:** MRR.

## M4 — Recall + WhatsApp (semana 11-12)
- [x] Sistema de recall: pacientes dormidos (>6 meses) → recordatorio
- [x] Recordatorios automáticos 24h antes (email/WhatsApp plantilla; fallback email si WhatsApp falla)
- [x] WhatsApp Cloud API add-on: plantillas utilidad (Meta `type:"template"`, fuera de ventana 24h) con fallback automático a email — requiere credenciales Meta
- [x] Notificación al paciente al reprogramar (email/WhatsApp, plantilla reprogramacion)
- [x] Retry de recordatorios fallidos (reenvío manual recall/recordatorio_24h desde consola)

**Salida:** margen ≥2x costo de plantilla.

## M5 — Lanzamiento (semana 13+)
- [ ] 30 consultorios objetivo: TikTok/IG casos de éxito + QR WhatsApp inbound
- [ ] Alianzas colegios profesionales

**Salida:** 10-30 clientes pagantes.

---

## v1.1.0 — Post-QA: observabilidad, portal paciente, fiscal avanzado, WhatsApp económico

- [x] Observabilidad de email en dev: servicio Mailpit (solo docker-compose.yml dev, :1025 SMTP / :8025 UI) + `MAIL_MODE=resend|smtp-dev` en lib/mail.ts. Producción sigue siendo Resend; el compose prod fija `MAIL_MODE=resend`
- [x] Portal paciente passwordless (token por paciente 30 días, sin cuentas): citas/historial, cuotas, comprobantes aceptados con descarga PDF/XML/CDR (ownership receipt→payment→patient), presupuesto, consentimientos, botón confirmar asistencia
- [x] Pago QR Yape/Plin con conciliación semi-automática por referencia (pago `por_conciliar` excluido de caja hasta conciliar; pagina consola "Pagos por conciliar")
- [x] Consentimiento del wizard público persistido en signed_consents (ya no se descartaba)
- [x] WhatsApp mínima huella (`WA_REPLY_MODE=silent|single|full`, default single): 1 mensaje por interacción con link a la web; keywords CONFIRMAR/CANCELAR conservadas; todos los entrantes/salientes a tabla `whatsapp_messages` + bandeja en consola
- [x] Fix webhook_verified_at: solo se estampa en filas con config completa (antes tocaba todas las activas)
- [x] Fiscal: QR SUNAT embebido en el PDF, logo de clínica en el PDF, baja REAL de boletas vía Resumen de Bajas (voided, ticket + consulta de estado), consulta de CDR diferido (`GET /invoice/status`), split aseguradora y edición de coberturas con UI, soporte/health con checks reales
- [x] Punto C: Playwright E2E (`npm run test:e2e`, matriz RBAC 28 rutas × 4 roles + flujo transversal), auditoría con filtros/paginación/export CSV, PWA offline real (offline-store IndexedDB + borrador de nota clínica)
- [x] Seed demo enriquecido e idempotente: aseguradoras/coberturas, inventario con lotes y kardex, laboratorio, presupuestos y cuotas
- [x] Fixes reales detectados por la E2E: `fmtFechaRelativa` crasheaba con fechas ISO (`/consola/inventario` RangeError); `/api/health` ya no da 503 por canales degradados (correo/lycet) — solo por la DB

---

## v1.2.0 — Doble local de WhatsApp + ensayo general en vivo (sin producción externa)

- [x] Fase A: `caja/pagos/[id]/aseguradora` rechaza pagos anulados (409); `cron/fiscal` consulta el CDR antes de reemitir comprobantes rechazados ya enviados (contador `cdrRecuperados`, evita duplicar notas aceptadas sin CDR local); `consultarCdrComprobante` acepta `pendiente_envio`/`rechazado`
- [x] Fase B: whatsmock local — repo `fdarian/whap` en `.references/whap`, servicio `whatsmock` en docker-compose (`:3010`, API Meta-compatible `/v22.0/{phoneNumberId}/messages` + `/mock/simulate-message`), `scripts/setup-whatsmock.ps1` idempotente, `WHATSAPP_BASE_URL` configurable en `lib/whatsapp.ts` (default sigue siendo Graph real)
- [x] Fase B: webhook de WhatsApp en `172.17.48.1:3111` (`WEBHOOK_URL` configurable vía `WHATSAPP_WEBHOOK_URL`; `host.docker.internal` no alcanza al host en WSL-Docker)
- [x] Fase C: `scripts/fiscal-demo.ts` configura el tenant demo para emisión electrónica contra **SUNAT beta real** (RUC 20161515648 / MODDATOS, certificado de pruebas lycet, Clave SOL cifrada con la master key dev) — idempotente
- [x] Fase D: ensayo general verificado en vivo:
  - WhatsApp: entrante simulado → respuesta single con link `localhost:3111/dental/reserva`; keyword REPROGRAMAR → link mágico
  - Portal paciente: resumen/cuotas/presupuestos con token; pago QR genera PNG + ref `ACF525` + pago `por_conciliar`; conciliación staff → cuota pagada; token inválido 404 y ownership en PDFs de terceros 404
  - Fiscal real SUNAT beta: boleta B001-5 emitida y aceptada (hash, XML, CDR), PDF con QR embebido, y baja: boleta → nota de crédito BN01-2 aceptada. Fix raíz: SUNAT rechaza DocumentTypeCode 03 en VoidedDocumentsLine — solo las facturas admiten Comunicación de Baja; boletas van por nota de crédito (código lo tenía invertido). Fix colateral: fechas sin serializar en raw SQL del correlativo voided
  - `NEXT_PUBLIC_APP_URL=http://localhost:3111` en `apps/web/.env.local`: links de correo/WhatsApp/portal ahora apuntan al servidor real de pruebas
- [x] Fase E: E2E Playwright 6/6 verde contra el build final con los cambios anteriores; typecheck limpio; backup real verificado (`scripts/backup.ps1` → `backups/*.dump`, retención 30 días, gitignored)

Salida: todo el stack corre 100% local con dobles de prueba (whatsmock, Mailpit, lycet→SUNAT beta), ensayo end-to-end verificado y sin tocar producción externa.

---

## v1.3.0 — Hardening pre-venta: legal editable, secrets fail-closed, backup prod

- [x] Cumplimiento legal por tenant (Ley 29733): migración 0016 `legal_settings` (razón social, RUC, domicilio, contacto ARCO, textos de privacidad/términos/consentimiento); plantillas legales en `lib/legal.ts` que se rellenan con los datos del responsable — son placeholders editables desde la UI, no textos fijos
  - UI `/consola/config/legal` (solo owner, gate `services.manage` como el resto de config): formulario de responsable + textareas + "Generar textos con mis datos" + vista previa pública + audit `legal.actualizar`
  - API pública `GET /api/clinicas/[clinica]/legal` (solo lectura, cache 5 min) y `GET/PUT /api/config/legal` (valida RUC 11 dígitos, email, máx 10k chars por texto)
  - Páginas públicas `/{clinica}/privacidad` y `/{clinica}/terminos`; el wizard de reserva ahora enlaza ambas desde el checkbox de consentimiento y el portal paciente las muestra en su footer
- [x] Secrets fail-closed: `docker-compose.prod.yml` ya no tiene defaults inseguros (`dev-cron-secret`, `odontoflow_dev`, `123456`, `ADMIN_EMAILS` demo, `NEXT_PUBLIC_APP_URL` localhost) — las variables obligatorias (`POSTGRES_PASSWORD`, `CRON_SECRET`, `LOCAL_MASTER_KEY`, `LYCET_TOKEN`, `NEXT_PUBLIC_APP_URL`) usan `${VAR:?mensaje}` y el `compose up` falla si faltan; los 6 `/api/cron/*` rechazan todo (401) si no hay `CRON_SECRET` configurado; nuevo `.env.prod.example` con generadores y advertencias (una sola `LOCAL_MASTER_KEY` para siempre)
- [x] Backup diario en producción: contenedor `cron` ahora trae `postgresql-client` + `backup-db.sh` (pg_dump -Fc a las 03:40 Lima → `./backups` del host vía volumen, retención 30 días, misma política que `scripts/backup.ps1` dev); entrypoint con su-exec para que el usuario sin privilegios pueda escribir en el bind mount. Verificado con restauración real (scratch DB → conteos correctos → drop)
- [x] Lint 100% limpio (0 warnings): 9 imports/vars sin usar eliminados; los 2 `<img>` restantes (QR data: del portal y fotos detrás de `/api/adjuntos`) llevan eslint-disable justificado: el optimizador next/image no optimiza data URLs ni pasa credenciales a endpoints autenticados
- [x] E2E Playwright 6/6 contra el build final (matriz RBAC ampliada a 29 rutas incluyendo `/consola/config/legal`)

Salida: todo lo internamente resoluble quedó resuelto. Solo resta lo externo: VPS + dominio + HTTPS, Resend con dominio verificado, credenciales/plantillas WhatsApp de Meta, CI remoto.

---

## v1.4.0 — Capacitación + QA responsive: centro de guías in-app, onboarding y móvil verificado

- [x] Fase 0 QA responsive: scripts de auditoría reutilizables (`apps/web/scripts/audit-responsive.mjs` ~34 rutas × 3 viewports 390/820/1440 con capturas; `audit-overflow-real.mjs` desbordes reales de documento; `audit-usabilidad.mjs` botones tapados/truncados/contraste). Resultado: **0 desbordes reales y 0 problemas de usabilidad** en móvil/tablet (las tablas ya usan wrappers scrollable; el shell móvil navega horizontal). La E2E gana proyecto persistente `mobile` (Pixel 7, RBAC) para regresión de layout
- [x] Fase 1 Centro de capacitación (patrón help center externo de Cliniko/Intercom adaptado a "nada externo todavía"):
  - `lib/guias.ts`: guías estructuradas por sección y rol como datos (formato migrable a Notion/Intercom si algún día se quiere el help center afuera)
  - `/consola/guia` in-app: filtra las guías según los permisos del rol del sesionista; sidebar gana "Guía de la app" en el grupo Soporte
  - `/{clinica}/guia` pública sin login (igual que privacidad/términos): el dueño envía el link a su equipo sin darles acceso todavía
  - 13 capturas reales de la app en `public/guia/`, regenerables con `scripts/captura-guia.mjs`
  - `/consola/soporte` reemplaza sus 3 guías inline por tarjeta al centro
- [x] Fase 2 Checklist de primeros pasos en el panel del owner: `console-data.primerosPasos()` calcula con datos reales (legal configurado, servicios, equipo invitado, pacientes como proxy de página compartida, primera cita confirmada); contador 0/5..4/5, items tachados al completar y la tarjeta desaparece sola al terminar. Verificado con tenant efímero vía `/api/auth/signup` (muestra 0/5) y el demo completo (oculta)
- [x] Fase 3 `docs/10-capacitacion.md`: guion del video demo escena por escena para grabarlo después con OBS (versión ventas 5 min + capacitación por rol 10 min) + procedimiento para regenerar capturas
- [x] Typecheck + lint + build verdes; E2E 11/11 contra el build final (6 desktop + 5 móvil)

Salida: entregable de capacitación para cuando se venda el servicio (guías in-app por rol, link público para el equipo, checklist de onboarding y guion de grabación) y el responsive verificado en celular/tablet con regresión automática.

---

## v1.5.0 — Celular de verdad: PWA instalable, ergonomia tactil y banner de instalacion

- [x] Fase 1 PWA realmente instalable: hasta ahora los iconos eran solo SVG (Chrome acepta SVG con fallback, pero iOS/iPadOS exige `apple-touch-icon` PNG y Android prefiere PNG), asi que la app era "agregable" pero no instalable de verdad. Nuevo `apps/web/scripts/genera-iconos.mjs` (Playwright renderiza el logo y exporta icon-192/icon-512/icon-512-maskable PNG a `public/icons/` + `src/app/apple-icon.png` que App Router convierte en `<link rel="apple-touch-icon">`). `manifest.webmanifest` actualizado con los 3 PNG (maskable separado para adaptive icons de Android), `theme_color` #0d9488 y start_url `/consola`. `layout.tsx`: `appleWebApp` movido de `Viewport` a `Metadata` (fix de tipos Next 15) y `viewportFit: "cover"` en viewport
- [x] Fase 2 Ergonomia tactil ≥48px sin tocar el diseño desktop: la regla no es un breakpoint de ancho sino el dispositivo — todos los controles ganan `min-h-12` (48px) solo bajo `[@media(pointer:coarse)]:` (Tailwind v4, media query arbitraria). `ui/button.tsx` lo trae en la base; iconos de la agenda (reprogramar/cancelar), tabs Dia/Semana/Mes, prev/next del calendario y quick actions del panel completan los tap targets. `shell.tsx`: `h-dvh`, header con `pt-[env(safe-area-inset-top)]`, padding inferior con safe-area, nav movil touch-friendly
- [x] Fase 3 Banner "Instala Odontoflow": nuevo `components/pwa/install-banner.tsx` montado en layout global. Aparece solo en dispositivo tactil (pointer:coarse), no standalone, nunca si ya fue descartado (localStorage `of-pwa-descartado`) y muestra instruccion con pasos correctos segun plataforma: iOS (Safari: Compartir → "Agregar a inicio", no existe install prompt nativo) / Android (menu → Instalar/Agregar)
- [x] Fase 4 Auditoria tactil: `audit-usabilidad.mjs` ahora corre con `hasTouch` (activa la misma media query que usa la app), mide tap targets <44px de controles con aspecto de boton (excluye links de texto inline) y descarta el banner de instalacion via init script para no contaminar. Resultado: **0 problemas** en movil/tablet tras los fixes
- Typecheck + lint (0 warnings) + build verdes; E2E 11/11 contra el build final (6 desktop + 5 movil Pixel 7); auditoria tactil 0 problemas en 11 rutas

Salida: la app puede instalarse en la pantalla de inicio de Android e iPhone como una app real (icono, splash, standalone), los botones cumplen el minimo tactil recomendado (≥44-48px) solo en dispositivos tactiles y el safe-area del notch esta cubierto.

---

## v1.5.1 — Estabilidad: fix navegacion SPA (service worker), server standalone y pool DB

Bug reportado: en Pacientes, la primera ficha cargaba normal, pero al volver atras y pulsar en otro paciente (u otro modulo) la navegacion no parecia funcionar; abrir en otra pestana si cargaba. Causa raiz: `public/sw.js` cacheaba el HTML de cada pagina visitada (`cache.put` en navigate), y ante fallos servia HTML viejo que referencia chunks JS de builds anteriores → pantalla sin contenido. Una pestana nueva no tenia ese cliente SW activo, por eso funcionaba.

- [x] Fix raiz `sw.js` (`of-cache-v2`): las navegaciones van siempre de red (nunca se cachea HTML de pagina); el unico fallback offline es `offline.html`; assets inmutables (`/_next/static/`, iconos) siguen cache-first; al activarse borra las caches antiguas, asi los clientes existentes migran solos al SW nuevo
- [x] `scripts/serve-console.ps1`: ya no usa `next start` (Next 15 lo rechaza con `output: "standalone"`; era el aviso permanente en `next-err.log`). Ahora arranca el server standalone oficial (`node .next/standalone/apps/web/server.js`, misma disposicion que el Dockerfile de produccion), copia `public/` y `.next/static/`, inyecta `apps/web/.env.local` (el server standalone no lo carga solo), apunta `ATTACHMENTS_DIR` al directorio real y solo mata instancias previas del propio server (antes mataba todos los nodos y podia tumbar scripts en curso)
- [x] `packages/db`: `max_lifetime: 300s` en el pool de postgres-js — fuerza reconexion periodica; cubre la ventana de sockets muertos cuando WSL suspende la VM (la otra causa de "navegacion que parecia no cargar": la primera query tras despertar fallaba y el fallback del SW lo enmascaraba)
- [x] UX: skeletons de carga en `/consola/pacientes` y `/consola/pacientes/[id]` (`PacientesSkeleton`, `FichaPacienteSkeleton`) — la navegacion SPA ahora muestra feedback inmediato en lugar de parecer congelada
- [x] Regresion E2E `e2e/navegacion.spec.ts` (antes la E2E solo usaba `page.goto` y este patron iba por debajo del radar): listado → click ficha → atras → click otra ficha (donde vivia el bug) → ida/vuelta repetida → nav SPA entre modulos; ademas verifica que el SW instalado no guarda HTML en cache
- Verificado: typecheck + lint (0 warnings) + build verdes; E2E **13/13** contra el build final (incluye los 2 nuevos de navegacion SPA); auditoria tactil 0 problemas; health con checks db/correo/lycet OK; `next-err.log` limpio

Salida: la navegacion interna vuelve a ser confiable en cualquier modulo; el servidor local corre en el modo soportado por Next y con las mismas disposiciones que produccion; el pool se recupera solo de la suspension de WSL; y el patron "click → atras → click" queda cubierto por regresion automatica.

---

## v1.6.0 — Suite E2E de operación en vivo (saturación real, resiliencia y rendimiento)

Nueva suite `playwright.vivo.config.ts` (`npm run test:e2e:vivo` y `test:e2e:vivo-serie`) que opera el consultorio demo de verdad, todo por UI, con datos únicos por corrida y sin teardown:

- [x] 4 specs de operación en paralelo (3 workers + móvil Pixel 7): alta de clínica completa (signup → checklist primeros pasos → slug duplicado 409 → página pública del slug nuevo), día de operación del owner (paciente → cita hoy → sala de espera → ficha/nota/odontograma → pago → comprobante → cierre) en desktop Y móvil, roles del equipo (RBAC real por UI: recepción/doctor/asistente con sus permisos y ausencias), y ciclo completo del paciente público (reserva → confirmación → correo Mailpit → reprogramar → cancelar)
- [x] Serie de resiliencia (un worker, va sola): offline real con service worker (pantalla sin conexión + recuperación), contienda de slots entre dos staff con lista stale (solo el primero gana), doble-click en "Crear paciente" (sin duplicados), corte real de Postgres con `docker pause` (skeleton de ficha, no pantalla blanca, recuperación al reanudar) y rate limit de login quemado (429 → la UI avisa amablemente)
- [x] Barrido de rendimiento: 16 rutas principales (públicas + consola) contra el server caliente; falla si una tarda >10s, queda en blanco (<40 chars) o lanza errores de página. Mejor: /consola en 73ms; peor: /consola/guia 47ms
- [x] **Bug real #1 (reserva pública):** `/api/gestionar/[token]` comparaba `startTime` sin normalizar ("08:00" vs "08:00:00") → reprogramación válida rechazada con "Ese horario acaba de ocuparse". Fix: `normalizarHora` en ambos lados
- [x] **Bug real #2 (doble reserva):** las citas "Sin doctor asignado" se podían apilar en el mismo horario sin límite: `POST /api/citas` solo validaba ocupación cuando había doctor, y el constraint de BD `appointments_no_overlap` excluye `doctor_id IS NULL`. Demostrado por la contienda E2E (dos citas en el mismo slot, 135ms aparte). Fix: `computeSlots` descuenta citas y bloqueos sin doctor del "bucket sin asignar" (sin bloquear la agenda de doctores puntuales) + la ruta de creación revalida contra `computeSlots` para citas sin doctor (mismo criterio que gestionar); `gestionar` excluye la propia cita
- [x] Fixes de spec descubiertos en el camino: el banner PWA de instalación (bottom sheet en pointer:coarse) tapaba el kanban móvil → se descarta una vez por sesión; el botón "Emitir" del comprobante se scopea al form del diálogo (hay uno por fila histórica); la merma de inventario usa el ítem con stock (el primero está en 0); el error esperado del router Next al perder RSC offline se filtra como ruido; `/dental` no es ruta (solo `/dental/reserva`); el option de paciente nuevo se selecciona por value `__nuevo__`
- [x] Verificado: typecheck + build verdes; **9/9** (operación, 3 workers + móvil) y **6/6** (serie) contra el build final; server standalone reiniciado con los fixes (health db/correo/lycet OK)

Salida: la suite cubre con presión real (paralelismo, cortes, offline, race conditions y rate limits) los flujos que un consultorio opera a diario, y destapó dos bugs reales de disponibilidad (falso rechazo de reprogramación pública y doble reserva de citas sin asignar) ya corregidos en el código.

---

## v1.6.1 — Navegación SPA con searchParams, Vista Día legible, wa.me y limpieza QA

Fixes de usabilidad y mantenimiento encontrados durante la auditoría de la regresión E2E de navegación:

- [x] **Causa raíz de la navegación rota (Next 15.5):** los controles que solo cambian `searchParams` (tabs de agenda Día/Semana/Mes, flechas, celdas de la semana, filtros de WhatsApp, pills de periodos del dashboard) dejaban de navegar en modo SPA a partir de la segunda vez. Investigación en la fuente instalada: `requestOptimisticRouteCacheEntry` (segment-cache-impl) reutiliza la entrada optimista del mismo pathname con `renderedSearch`/`canonicalUrl` de la **primera** navegación; las siguientes re-reproducen esa primera URL (la entrada queda "envenenada"). El camino popstate/RESTORE quedó descartado (requiere tree propio en el estado de history)
- [x] **Fix determinista en tres capas** — `useNavegar()` (`apps/web/src/lib/navegar.ts`): 1) `router.prefetch(url)` crea una entrada de ruta exacta; 2) `router.push(url)` navega en SPA con esa entrada; 3) fallback `location.assign` a los 500ms solo si la URL sigue igual al momento del click **y** no hubo más de un `history.pushState` en el medio (conteo de pushStates: distingue push colgado 0, entrada envenenada 1, y varias navegaciones rápidas ≥2 que no deben disparar nada aunque terminen en la misma URL). Se aplicó en `AgendaToolbar`, `LinkDia` (celdas de semana/mes), `WhatsappFiltros`/`WhatsappPaginacion` y `PeriodosPills` del dashboard
- [x] **Vista Día legible:** agenda de citas limitada a 4 carriles con chip "+N más" cuando un cluster desborda, filas alternadas para seguir la rejilla y etiquetas de hora alineadas al margen; chips con borde sutil
- [x] **"Llamar a la primera"** en la cola de solicitudes → enlace `https://wa.me/<celular>` con el número limpio de no-dígitos
- [x] **Limpieza de datos QA acumulados:** `packages/db/src/limpia-datos-qa.ts` (`npm run db:clean`) borra pacientes/citas/pagos/comprobantes de prueba (patrones `Paciente E2E/Vivo/Publico`, `Recepcion`, `Contienda`, `Dueña E2E`, `Dueño Dup`, emails `@e2e.local`, `@equipo.local`, etc.) respetando el orden de FK (con `cita_id` en reminders y signed_consents)
- [x] **Regresión E2E ampliada** (`e2e/navegacion.spec.ts`): mismo patrón sin recargas para agenda (tabs → flecha Siguiente → celda de la semana), filtros de WhatsApp y periodos del dashboard. El primer intento con `router.push` puro falló exactamente en el patrón (click Mes tras Semana quedaba en `vista=semana`), lo que destapó la causa raíz
- [x] Verificado: typecheck + lint (0 warnings) + build verdes; **3/3** regresión de navegación, **9/9** vivo y **6/6** serie contra el build final; `db:clean` post-suites (6 pacientes, 5 citas, 3 pagos, 2 comprobantes); server standalone reiniciado (health 200)

Salida: la consola vuelve a navegar 100% en SPA entre estados del mismo módulo (sin recargas ni pestañas nuevas), la Vista Día se lee con clusters de citas contenidos y "Llamar a la primera" abre WhatsApp con un toque; los datos QA de las suites ya no ensucian la agenda demo.

---

## v1.6.2 — Pulido de v1.6.1: fix de navegación sin parches globales, chip "+N más" interactivo, cobertura y ergonomía

Revisión del código introducido en v1.6.1 para corregir lo agresivo/huerverano:

- [x] **`useNavegar()` reescrito (apps/web/src/lib/navegar.ts), sin parches globales:** fuera el envoltorio de `history.pushState` global y el contador global de eventos, que era invasivo y traía una recarga spurious al fallar. Lo de v1.6.1 se reemplaza por un token por click que cancela el anterior, con doble condición en el fallback `location.assign` (la URL sigue exactamente igual al click **y** no es ya la de destino): no hay recarga al pulsar "Hoy" estando en hoy ni con doble click. Envoltorio `useCallback` estable. Se aplica ahora también en la pestaña "Ver mes" de comisiones y en la rama de búsqueda del command-palette (las dos llamadas a `router.push(searchParams)` que no arreglaba v1.6.1)
- [x] **Chip "+N más" de la Vista Día interactivo:** ahora es un botón real (antes reaccionaba a ningún evento). Al hacer click abre un popover con las citas omitidas por solapamiento (hora, paciente, servicio); se cierra con clic fuera o con la tecla ESC
- [x] **Ergonomía táctil restaurada en los controles reescritos de v1.6.1:** los filtros de WhatsApp (todos/entrantes/salientes), la paginación "Siguientes"; los envoltorios del dashboard ahora llevan la altura táctil (≥48px) de `[@media(pointer:coarse)]:min-h-12` sin cambiar cómo se ven en escritorio (los tienen un `min-h-9` base)
- [x] Verificado: typecheck + lint (0 warnings) + build verdes; **14/14** regresión, **9/9** vivo (escritorio + móvil Pixel 7) y **6/6** serie contra el build final; `db:clean` post-suites (7 pacientes, 6 citas, 4 pagos, 2 comprobantes)

Salida: la mitigación para el bug de navegaciones con searchParams es autónomo, cubre todos los puntos que cambian searchParams, y las citas que se solapan en la Vista Día recuperan visibilidad y dimensiones táctiles.

---

## v1.7.0 — Soporte de plataforma: fundador, acciones de soporte e impersonación auditada

Plan completo en `docs/07-soporte-plataforma.md` (problema, patrones externos verificados
en cal.com/dub/chatwoot, hechos del código actual, checklist por capa y E2E). Resumen:

- [x] Cuenta fundador real: `users.is_platform_admin` + sesión plataforma sin membership;
      `isAdmin()` deja de leer `ADMIN_EMAILS` (se elimina el fallback hardcodeado a la demo);
      login con `locked_at`, redirección `/admin` y cambio de contraseña obligatorio en el
      primer login (`must_change_password` + `/primer-acceso`). Seed con password TEMPORAL.
- [x] Migración 0017: columnas nuevas en `users`/`sessions` + tabla `impersonation_requests`.
- [x] APIs admin (`/api/admin/*`): miembros por tenant, reenvío de recuperación
      (patrón cal.com `sendPasswordReset`: reutiliza el flujo self-service server-side),
      bloqueo/desbloqueo de usuario y membresía, impersonación por token de 1 uso (15 min,
      sesión de 8h con `impersonated_by_user_id`), fin de impersonación. Todo auditado en el
      tenant afectado con `via: "soporte_plataforma"`.
- [x] UI: `/admin` con miembros expandibles y acciones por miembro; banner permanente de
      impersonación en el shell de consola con botón "Salir".
- [x] E2E `admin.spec.ts` (login fundador → primer cambio → reenvío vía Mailpit →
      impersonar con banner → salir → usuario bloqueado sin login → token vencido).
- [x] Docs batch: README puerto **3111** (no 3000), `ADMIN_EMAILS` como bootstrap
      deprecated, aclaración BoxyHQ = modelo de datos re-implementado (no fork/motor),
      filas nuevas en 00-resumen/04-modelo-datos/01-topologia.
- [x] Verificado: typecheck + lint (0 warnings) + build standalone fresco (con `/primer-acceso`); **12/12** admin, **14/14** regresión, **9/9** vivo y **6/6** serie contra el build final; health `{db, correo, lycet}: true`; `db:clean` post-suites (10 pacientes, 9 citas, 6 pagos, 4 comprobantes)

Salida: el operador del SaaS tiene identidad propia y herramientas de soporte auditadas
(recuperación, bloqueos, impersonación) sin depender de SQL manual ni del owner demo.

---

## Organización del tier Pro: features gateadas por plan (v1.7.1)

Regla de negocio: Free conserva el flujo de reservas completo (página pública,
agenda, cola, sala de espera, personal, ficha básica con odontograma y notas) y las
confirmaciones/reprogramación/waitlist. Pro añade la ficha clínica avanzada y los
recordatorios (cualquier envío email/WhatsApp). Premium no cambia. Sin migraciones
ni cambios de roles.

- [x] `lib/plans.ts`: `PlanFeature` gana `ficha_avanzada` y `recordatorios`;
      `FEATURE_PLAN` = `dashboard:"pro"`, `ficha_avanzada:"pro"`,
      `recordatorios:"pro"` (resto premium); helpers `planDeTenantSinCache` y
      `planEsProOMayor` para rutas no-RSC (crons).
- [x] Páginas gateadas a Pro (`gatePlan` + `PlanGate`): `/consola/recall`,
      `/consola/config/whatsapp`, `/consola/config/notificaciones`,
      `/consola/campanas`, `/consola/reviews`, `/consola/whatsapp` (bandeja);
      `/consola/dashboard` ya estaba gateado y ahora exige Pro.
- [x] APIs gateadas a Pro (402 `plan_insuficiente`, tras `guardStaff`):
      recordatorios — `config/notificaciones` (POST), `config/whatsapp` (GET+PUT),
      `config/reviews` (GET+PUT), `whatsapp/mensajes` (GET), `recall` (POST),
      `campanas` (GET+POST), `campanas/[id]/ejecutar` (POST), `reviews` (POST),
      `reviews/[id]/respondido` (PATCH); ficha avanzada — `pacientes/[id]/adjuntos`,
      `[id]/consentimientos`, `[id]/laboratorio`, `laboratorio/[id]/estado`,
      `adjuntos/[id]`, `coberturas/[id]`, `pacientes/[id]/coberturas`,
      `aseguradoras`, `aseguradoras/[id]`.
- [x] Crons que envían email/WhatsApp saltan tenants no-Pro (sin gasto en Free):
      `recordatorios` (24h y retry), `recall`, `diario`.
- [x] Ficha del paciente: en Free se ocultan los bloques avanzados (laboratorio,
      fotos antes/después, seguros/coberturas, documentos/consentimientos) con hint
      "es parte del plan Pro"; odontograma y notas clínicas siguen visibles.
- [x] `/consola/config/suscripcion`: listas de planes alineadas (ficha básica en
      Free, avanzada + recordatorios + dashboard en Pro, caja/facturación/inventario/
      presupuestos/comisiones en Premium).
- [x] E2E `01-alta-clinica`: test "un plan Free no accede a funciones Pro"
      (dashboard → PlanGate "es parte del plan Pro", `POST /api/config/notificaciones`
      → 402, `POST /api/pacientes/<falso>/adjuntos` → 402).

---

## Backlog post-M5 → incluido en 1.0

Topología detallada por módulo en `docs/05-modulos-topologia.md`.

- [x] Facturación electrónica — sidecar Greenter `lycet` (cada tenant con SU RUC/certificado/Clave SOL)
- [x] Baja SUNAT real: boleta vía Resumen de Bajas (RA, ticket, asíncrono) y factura vía nota de crédito (tipoDoc 07, codMotivo 01)
- [x] Comprobantes manuales editables (serie/correlativo) y anulables
- [x] Inventario odontológico (receta de materiales por servicio, lotes, vencimientos, kardex)
- [x] Lista de espera anti-huecos (cancelación → ofrecer slot a waitlist) + re-encolar si no respondió (ofrecida→activa)
- [x] Reseñas Google post-consulta
- [x] Ciclo completo presupuestos/cuotas: borrador→enviado→aprobado→convertido automático al pagar la última cuota; cuotas pagable/cancelable vinculadas al pago
- [x] Comisiones por doctor (% por procedimiento)
- [x] Campañas de cumpleaños/reactivación
- [x] Inventario → costo real por procedimiento (márgenes)
- [x] Laboratorio/protésico (seguimiento coronas) + retrocesos de un paso con motivo (rev/motivoRevision)
- [x] Fotos antes/después por tratamiento (fotoOrden automático por grupo + ordenamiento en galería)
- [x] EPS/seguros odontológicos (clínicas medianas)
- [x] Multi-sucursal + benchmark interno
- [x] Exportación contable SUNAT / registro de ventas Excel
- [x] Portabilidad/ARCO (Ley 29733) export 1 clic
- [x] Seed demo mejorado (5 usuarios multirol, plan premium, 13 citas en ayer/hoy/mañana, 6 pagos, turnos L-V)
- [x] Modo offline PWA (instalable + fallback sin conexión; cacheo de agenda como mejora futura)
- [x] Infra de producción: `docker-compose.prod.yml` (db + lycet + web standalone :3111) + contenedor `cron` (supercronic, CRON_TZ=America/Lima) que ejecuta los 6 jobs reales (`recordatorios`, `renovaciones`, `fiscal` horarios; `diario`, `recall`, `seguimiento` diarios). `scripts/instalar-cron.ps1` relegado a dev Windows
