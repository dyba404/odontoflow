import type { StaffRole } from "@odontoflow/core";

export interface Guia {
  id: string;
  titulo: string;
  descripcion: string;
  roles: StaffRole[];
  captura?: string;
  pasos: string[];
  tip?: string;
}

export interface GuiaSeccion {
  id: string;
  icono: string;
  titulo: string;
  descripcion: string;
  guias: Guia[];
}

export const GUIAS: GuiaSeccion[] = [
  {
    id: "primeros-pasos",
    icono: "rocket",
    titulo: "Primeros pasos",
    descripcion: "Configura tu clínica en 30 minutos y queda lista para recibir pacientes.",
    guias: [
      {
        id: "configurar-clinica",
        titulo: "Configura los datos de tu clínica",
        descripcion:
          "Datos del responsable legal y textos de privacidad que se publican en tu página de reservas.",
        roles: ["owner"],
        captura: "/guia/config-legal.png",
        pasos: [
          "Abre Configuración → Cumplimiento legal.",
          "Completa la razón social, RUC, domicilio legal y el correo donde recibirás las solicitudes de datos personales (Ley 29733).",
          "Pulsa “Generar textos con mis datos”: las plantillas de política de privacidad y términos se rellenan con tus datos automáticamente.",
          "Revisa los textos generados en las vistas previas públicas. Si tu asesor legal te indica otra versión, reemplázala en los campos de texto.",
          "Guarda. Los cambios se publican al instante en /tu-clinica/privacidad y /tu-clinica/terminos.",
        ],
        tip: "Solo el rol Dueño/a puede editar la configuración legal; cada cambio queda registrado en Auditoría.",
      },
      {
        id: "crear-servicios",
        titulo: "Crea tus servicios y precios",
        descripcion: "El catálogo de servicios es la base de la página de reservas y de la caja.",
        roles: ["owner"],
        captura: "/guia/config-servicios.png",
        pasos: [
          "Abre Configuración → Servicios.",
          "Pulsa “Nuevo servicio”: nombre, duración en minutos (define el tamaño del slot), buffer y precio.",
          "El buffer es el tiempo extra que se respeta entre citas (ej. limpieza entre pacientes).",
          "Activa o desactiva servicios según temporada; los desactivados desaparecen de la página pública.",
        ],
        tip: "La duración + buffer del servicio determinan qué horarios se ofrecen en la reserva en línea.",
      },
      {
        id: "invitar-equipo",
        titulo: "Invita a tu equipo",
        descripcion:
          "Cada miembro recibe una invitación por correo con su rol: recepción, asistente u odontólogo.",
        roles: ["owner"],
        pasos: [
          "Abre Personal → Invitar.",
          "Escribe el correo y elige el rol: Recepción (agenda + caja + comprobantes), Asistente (datos + estados + adjuntos) u Odontólogo (su agenda + fichas + notas clínicas).",
          "El invitado recibe un enlace para crear su contraseña.",
          "Revisa en Personal quién aceptó la invitación y ajusta roles si hace falta.",
        ],
        tip: "Por defecto el asistente NO tiene acceso a caja ni a ingresos; puedes elevarlo a recepción si tu clínica es pequeña.",
      },
      {
        id: "compartir-reservas",
        titulo: "Comparte tu página pública de reservas",
        descripcion: "Envía el enlace a tus pacientes: ellos reservan sin descargar nada.",
        roles: ["owner", "receptionist"],
        captura: "/guia/reserva.png",
        pasos: [
          "Tu página pública es: la dirección de Odontoflow + / + el nombre corto de tu clínica (slug) + /reserva. La ves en Soporte → Compartir página.",
          "Compártela por WhatsApp y añádela a tus perfiles de Instagram, Facebook y Google.",
          "El paciente elige servicio, fecha e horario, y envía su solicitud.",
          "Cada solicitud aparece en la cola de Solicitudes para que recepción la confirme.",
        ],
      },
    ],
  },
  {
    id: "citas",
    icono: "calendar",
    titulo: "Citas y sala de espera",
    descripcion: "El día a día de recepción y consultorio: confirmar, atender y cerrar cada cita.",
    guias: [
      {
        id: "confirmar-solicitudes",
        titulo: "Confirma una solicitud de cita",
        descripcion: "Revisa la cola de pedidos en línea y asigna doctor y hora exacta.",
        roles: ["owner", "receptionist"],
        captura: "/guia/solicitudes.png",
        pasos: [
          "Abre Solicitudes en el menú: ahí aparecen los pedidos enviados por la página pública.",
          "Revisa paciente, servicio, fecha y doctor preferido. Si el horario no funciona, usa Rechazar y el paciente recibirá un correo para reelegir.",
          "Pulsa Confirmar para asignar la cita al doctor y horario elegidos.",
          "Al confirmar, el paciente recibe un correo con la hora exacta y un enlace privado para reprogramar o cancelar.",
        ],
      },
      {
        id: "dia-a-dia",
        titulo: "El flujo de la cita: llegada → atención → cierre",
        descripcion: "Estados de cada cita y quién los mueve durante el día.",
        roles: ["owner", "receptionist", "assistant", "doctor"],
        captura: "/guia/sala-espera.png",
        pasos: [
          "Abre Sala de espera el día de las citas: verás tres columnas vivas (Por llegar, En sala, En atención).",
          "Llega el paciente: recepción pulsa Llegó en su tarjeta; la cita pasa a la columna En sala.",
          "El asistente o doctor pulsa Llamar cuando lo va a atender; la tarjeta pasa a En atención.",
          "El doctor escribe la nota clínica en la ficha y pulsa Finalizar: la cita queda Atendida.",
          "Recepción cobra el pago en Caja del día y registra la próxima cita.",
          "Si el paciente no llega, márcala como No-show desde la agenda.",
        ],
        tip: "La sala se actualiza al instante en todas las pantallas del equipo (en vivo): déjala abierta en una pantalla del recepción como tablero del consultorio.",
      },
      {
        id: "reprogramar",
        titulo: "Reprogramar o cancelar una cita",
        descripcion: "Desde la agenda o desde el enlace que recibió el paciente.",
        roles: ["owner", "receptionist", "doctor"],
        captura: "/guia/agenda.png",
        pasos: [
          "En Agenda, abre la cita y usa Reprogramar (nueva fecha/hora) o Cancelar.",
          "El paciente recibe la notificación del cambio automáticamente por correo.",
          "El paciente también puede reprogramar o cancelar desde el enlace privado de su correo (sin crear cuenta, válido 30 días).",
          "Al cancelar una cita confirmada, la lista de espera ofrece el hueco a pacientes en cola.",
        ],
      },
      {
        id: "odontograma",
        titulo: "Ficha del paciente y odontograma profesional",
        descripcion:
          "Datos, antecedentes, alergias y el odontograma por superficies con autoguardado.",
        roles: ["owner", "doctor", "assistant"],
        captura: "/guia/ficha.png",
        pasos: [
          "Abre Pacientes y elige al paciente (o búscalo con Ctrl K).",
          "En la ficha: datos de contacto, antecedentes, alergias (badge visible en toda la app), pagos y citas.",
          "El odontograma muestra los 32 dientes FDI: toca un diente y registra el hallazgo sobre la superficie exacta (oclusal, vestibular, lingual, mesial o distal), como en la historia clínica en papel.",
          "Cada cambio se guarda solo mientras dibujas: no hay botón guardar ni riesgo de perder el registro si cierras la pestaña.",
          "Adjunta radiografías o fotos en la sección correspondiente; el asistente puede subir adjuntos.",
        ],
        tip: "El odontograma solo lo editan roles con permiso clínico (Dueño/a y Odontólogo); el asistente lo consulta para preparar la cita.",
      },
    ],
  },
  {
    id: "clinica",
    icono: "tooth",
    titulo: "Clínica avanzada",
    descripcion: "Periodontograma, planes de tratamiento, presupuestos con firma digital y consentimientos.",
    guias: [
      {
        id: "periodontograma",
        titulo: "Periodontograma y snapshots",
        descripcion: "Registra sondaje, furcaciones y movilidad; guarda snapshots del estado periodontal.",
        roles: ["owner", "doctor"],
        pasos: [
          "Abre la ficha del paciente y entra al odontograma; cambia al modo Periodontograma.",
          "Registra el sondaje por diente y superficie, además de furcaciones y movilidad.",
          "Pulsa Guardar snapshot (con nota opcional) para congelar el estado completo del sondaje en ese momento.",
          "Los snapshots son inmutables: quedan como historial fechado en la ficha para comparar la evolución entre visitas.",
        ],
        tip: "Si intentas guardar sin datos registrados, la app te avisa: primero completa el sondaje en el editor.",
      },
      {
        id: "planes-tratamiento",
        titulo: "Planes de tratamiento",
        descripcion: "Pipeline por paciente: borrador, pendiente, activo, completado o cerrado.",
        roles: ["owner", "doctor"],
        pasos: [
          "Crea el plan desde la ficha del paciente: título y doctor responsable.",
          "El plan nace en Borrador; muévelo a Pendiente cuando se lo presentes al paciente y a Activo cuando acepta empezar.",
          "Marca Completado al terminar el tratamiento; si el paciente desiste usa Cerrado indicando el motivo (queda registrado).",
          "En Negocios → Planes de tratamiento ves el pipeline completo de la clínica con número, doctor y estado de cada plan.",
        ],
        tip: "Un plan activo es tu mejor predictor de ingresos futuros: revisa los pendientes cada semana y llámalos para cerrarlos.",
      },
      {
        id: "presupuesto-firma",
        titulo: "Envía un presupuesto con firma digital",
        descripcion: "El paciente recibe un enlace seguro, valida con código 2FA y firma desde su celular.",
        roles: ["owner", "receptionist", "doctor"],
        pasos: [
          "Desde Presupuestos pulsa Nuevo presupuesto: elige paciente, ítems, montos y cuotas.",
          "Usa Enviar link: la app genera un enlace privado para que el paciente revise la cotización.",
          "Al abrir el enlace, el paciente valida su identidad con un código de 2 pasos enviado por la clínica.",
          "Ya dentro, revisa el detalle y firma directamente con el dedo o mouse sobre el pad de firma.",
          "El presupuesto queda Aceptado con nombre del firmante, fecha e imagen de firma; lo ves desde Presupuestos en la consola.",
        ],
        tip: "Comparte el código 2FA por WhatsApp o llamada: así garantizas que solo el titular pueda ver y firmar el presupuesto.",
      },
      {
        id: "consentimientos-v2",
        titulo: "Consentimientos informados digitales",
        descripcion: "Plantillas listas para firmar antes de cada tratamiento, desde la ficha del paciente.",
        roles: ["owner", "doctor"],
        pasos: [
          "En Consentimientos administra tus plantillas: crea una por tipo de tratamiento (extracción, ortodoncia, blanqueamiento…).",
          "Solo doctores y dueños pueden crear o editar plantillas; el resto del equipo solo las usa.",
          "Desde la ficha del paciente, elige la plantilla y envía el consentimiento a firmar.",
          "La firma queda registrada con fecha, nombre del firmante y versión exacta del texto que aceptó.",
        ],
        tip: "Guarda una versión nueva de la plantilla en lugar de sobrescribir el texto: así cada firma queda atada al contenido que el paciente vio.",
      },
    ],
  },
  {
    id: "caja",
    icono: "wallet",
    titulo: "Caja y cobros",
    descripcion: "Registra pagos, cuadra el día y concilia los pagos QR de tus pacientes.",
    guias: [
      {
        id: "registrar-pago",
        titulo: "Registrar un pago en caja",
        descripcion: "Yape, Plin, efectivo o POS. El total del día se cuadra solo.",
        roles: ["owner", "receptionist"],
        captura: "/guia/caja.png",
        pasos: [
          "Abre Caja del día y pulsa Registrar pago: elige el paciente o la cita atendida.",
          "Ingresa el monto y el método: Yape, Plin, efectivo, tarjeta POS o seguro.",
          "Añade la referencia u operación del pago para cuadrar con tu billetera o POS.",
          "Al cerrar el día, usa Cierre de caja: la app compara lo registrado contra lo que debería haber, y muestra la diferencia.",
        ],
      },
      {
        id: "anular-pago",
        titulo: "Anular un pago (corrección contable)",
        descripcion: "Reversa un mal registro sin borrar el rastro.",
        roles: ["owner", "receptionist"],
        pasos: [
          "En Caja del día, abre el pago y elige Anular.",
          "Escribe el motivo (mínimo 3 caracteres): queda en la auditoría.",
          "El pago anulado sale del total del día y sus cuotas vuelven a pendiente si las hubiera.",
        ],
        tip: "Anular nunca borra el registro: siempre queda el motivo y el usuario que lo hizo en Auditoría.",
      },
      {
        id: "conciliar-qr",
        titulo: "Conciliar pagos QR (Yape/Plin)",
        descripcion: "Cuando un paciente paga desde su portal con QR, el pago queda “por conciliar”.",
        roles: ["owner", "receptionist"],
        captura: "/guia/cuotas.png",
        pasos: [
          "Abre Negocios → Pagos por conciliar: ahí aparecen los pagos QR pendientes.",
          "Verifica que el monto y la referencia coincidan con tu billetera Yape/Plin o tu cuenta Plin.",
          "Pulsa Confirmar para validarlo (la cuota queda pagada) o Rechazar si no llega el dinero.",
          "Mientras no se concilie, el pago NO cuenta en la caja del día: es dinero aún sin verificar.",
        ],
      },
      {
        id: "split-seguro",
        titulo: "Split con aseguradora (EPS/seguro)",
        descripcion: "Divide un pago entre el paciente y su seguro en un clic.",
        roles: ["owner", "receptionist"],
        pasos: [
          "Registra el pago con el método Seguro y elige la cobertura del paciente.",
          "Usa el split de aseguradora: indicas qué porcentaje o monto cubre el seguro y qué paga el paciente.",
          "Cada parte queda como movimiento separado para la facturación con la aseguradora.",
        ],
      },
    ],
  },
  {
    id: "fiscal",
    icono: "receipt",
    titulo: "Comprobantes electrónicos (SUNAT)",
    descripcion: "Boletas, facturas y notas conectadas a SUNAT, con XML, CDR y PDF con QR.",
    guias: [
      {
        id: "config-fiscal",
        titulo: "Configura la facturación electrónica",
        descripcion: "RUC, Clave SOL y certificado digital, cifrados en la base de datos.",
        roles: ["owner"],
        captura: "/guia/config-fiscal.png",
        pasos: [
          "Abre Configuración → Facturación.",
          "Elige el modo: Emisión electrónica (SUNAT) o Manual.",
          "Completa RUC, usuario SOL y Clave SOL; sube tu certificado digital en formato .key/.pem.",
          "Tus credenciales se guardan cifradas y se usan solo para firmar los envíos a SUNAT.",
        ],
        tip: "Empieza en ambiente Beta para probar sin riesgos y cambia a Producción cuando SUNAT acepta tus comprobantes de prueba.",
      },
      {
        id: "emitir",
        titulo: "Emitir boleta o factura",
        descripcion: "Genera el comprobante sobre un pago, con envío automático a SUNAT.",
        roles: ["owner", "receptionist"],
        captura: "/guia/comprobantes.png",
        pasos: [
          "Abre Negocios → Comprobantes y pulsa Emitir sobre el pago.",
          "Elige boleta o factura, revisa la serie y correlativo sugeridos y confirma.",
          "La app envía el comprobante a SUNAT; el estado pasa a Aceptado (o Pendiente si SUNAT aún procesa).",
          "Descarga el PDF con QR y el XML/CDR cuando quieras; también el paciente lo ve en su portal.",
        ],
      },
      {
        id: "baja",
        titulo: "Dar de baja un comprobante",
        descripcion: "Anula un comprobante aceptado por SUNAT, con registro contable.",
        roles: ["owner", "receptionist"],
        pasos: [
          "En Comprobantes, abre el comprobante aceptado y pulsa Dar de baja.",
          "Escribe el motivo. Las boletas recientes van por Comunicación de Baja; facturas y boletas antiguas por Nota de Crédito.",
          "El estado queda Baja pendiente y se resuelve solo cuando SUNAT procesa el ticket.",
        ],
        tip: "La baja solo aplica a comprobantes Aceptados; si SUNAT lo rechazó primero, no se da de baja.",
      },
    ],
  },
  {
    id: "pacientes",
    icono: "users",
    titulo: "Portal del paciente y comunicación",
    descripcion: "Enlaces privados sin cuenta, cuotas, recall y campañas.",
    guias: [
      {
        id: "portal-paciente",
        titulo: "El portal de tu paciente",
        descripcion:
          "Enlace privado de 30 días: citas, cuotas, comprobantes, consentimientos y formularios, sin cuenta.",
        roles: ["owner", "receptionist"],
        captura: "/guia/portal.png",
        pasos: [
          "Envía el enlace desde la ficha del paciente (botón Portal): se genera un link personal que expira a los 30 días por seguridad.",
          "Tu paciente ve sus próximas citas e historial, y puede confirmar asistencia o reprogramar/cancelar él mismo desde el portal.",
          "Ve sus cuotas pendientes con opción de pagar por QR; el pago entra a Negocios → Pagos por conciliar para que lo valides.",
          "Descarga sus comprobantes electrónicos en PDF y revisa los consentimientos que ya firmó.",
          "Completa su formulario de admisión (intake) antes de la primera cita: los datos llegan directo a su ficha clínica.",
          "Si le configuraste instrucciones pre o post-operatorias al servicio, las ve junto a cada cita (ej. ayuno, cuidados tras la extracción).",
        ],
        tip: "Puedes reenviar el enlace cuando quieras desde la ficha; cada envío genera un enlace vigente nuevo.",
      },
      {
        id: "cuentas-familiares",
        titulo: "Menores de edad y cuentas familiares",
        descripcion: "Vincula al representante legal con el paciente menor de edad.",
        roles: ["owner", "receptionist"],
        pasos: [
          "Abre la ficha del paciente menor y pulsa Representante.",
          "Elige un paciente adulto existente como representante legal o registra los datos del apoderado.",
          "Las notificaciones de citas del menor también llegan al representante.",
          "Los pagos y comprobantes del menor quedan asociados para que el responsable los revise desde su portal.",
        ],
        tip: "Útil para hermanos con el mismo apoderado: un solo responsable recibe toda la comunicación familiar.",
      },
      {
        id: "recall",
        titulo: "Recall de pacientes dormidos",
        descripcion: "Reactiva a los pacientes que no vienen en meses con un recordatorio.",
        roles: ["owner", "receptionist"],
        captura: "/guia/recall.png",
        pasos: [
          "Abre Negocios → Recall: la app calcula automáticamente pacientes dormidos (más de 6 meses) y en riesgo (4-5 meses).",
          "Pulsa Recordar en cada fila para enviar el mensaje de reactivación (correo o WhatsApp si lo configuraste).",
          "El sistema reintenta automáticamente los envíos fallidos.",
        ],
      },
      {
        id: "campanas",
        titulo: "Campañas de cumpleaños y reactivación",
        descripcion: "Mensajes programados para fechas especiales.",
        roles: ["owner", "receptionist"],
        pasos: [
          "Abre Negocios → Campañas y crea una de cumpleaños o reactivación.",
          "Elige el canal (correo y/o WhatsApp) y el texto.",
          "Actívala y la app la ejecuta en su cronograma; los resultados quedan en la auditoría.",
        ],
      },
    ],
  },
  {
    id: "canales",
    icono: "message",
    titulo: "WhatsApp, reseñas y legal",
    descripcion: "Canales de comunicación y cumplimiento normativo.",
    guias: [
      {
        id: "whatsapp",
        titulo: "Conecta WhatsApp (Cloud API)",
        descripcion: "Respuestas automáticas de citas, plantillas oficiales de Meta y bandeja bidireccional.",
        roles: ["owner"],
        pasos: [
          "Necesitas una cuenta Meta Business y una línea de WhatsApp API.",
          "En Configuración → WhatsApp pega tu Phone Number ID y token de acceso (se guardan cifrados).",
          "Configura la dirección del webhook en tu panel de Meta con la URL que te muestra la app.",
          "La política de respuesta (silent/single/full) controla cuántos mensajes envía el bot por interacción.",
          "Con el webhook activo, cada mensaje que te escriban queda registrado en Negocios → WhatsApp.",
        ],
        tip: "El modo “single” responde un solo mensaje con el enlace web: toda la conversación ocurre gratis en la web y ahorras costos por mensaje.",
      },
      {
        id: "whatsapp-bandeja",
        titulo: "Responde mensajes desde la bandeja de WhatsApp",
        descripcion: "Mensajes entrantes y salientes en un solo hilo, con respuesta directa.",
        roles: ["owner", "receptionist"],
        pasos: [
          "Abre Negocios → WhatsApp: la bandeja muestra todos los mensajes entrantes y salientes con su fecha y paciente.",
          "Usa los filtros para ver solo los entrantes sin responder y prioriza quién espera respuesta.",
          "Pulsa Responder en un mensaje para escribirle al paciente desde la app; el envío sale por tu línea de WhatsApp API.",
          "Cada conversación queda registrada para auditoría: verás qué se envió automáticamente y qué respondió el equipo.",
        ],
        tip: "Si un mensaje entrante no recibe respuesta automática (ej. quedó fuera del horario), respóndelo manualmente desde la bandeja para no dejar al paciente esperando.",
      },
      {
        id: "resenas",
        titulo: "Reseñas de Google tras la consulta",
        descripcion: "Configura tu perfil de Google Business para pedir valoraciones.",
        roles: ["owner", "receptionist"],
        pasos: [
          "En Reseñas de Google, pega el enlace de reseña de tu perfil de Google Business.",
          "Activa la reseña automática: tras cada cita atendida se envía un mensaje con el enlace de reseña.",
          "Sigue las reseñas pendientes desde la misma página.",
        ],
      },
      {
        id: "arco",
        titulo: "Solicitudes ARCO (Ley 29733)",
        descripcion: "Atiende solicitudes de acceso, rectificación, cancelación u oposición.",
        roles: ["owner"],
        pasos: [
          "Los pacientes pueden solicitar sus derechos ARCO por los canales de contacto legales.",
          "En Auditoría y ARCO registras la solicitud: acceso, rectificación, cancelación u oposición de datos.",
          "Genera el paquete de datos del paciente en un clic para responder las solicitudes de acceso o portabilidad.",
          "Atiende o rechaza con motivo dentro de los plazos legales.",
        ],
      },
    ],
  },
  {
    id: "crecimiento",
    icono: "chart",
    titulo: "Crecimiento y retención",
    descripcion: "Series de citas, referidos, recuperación de no-shows, producción y digest diario.",
    guias: [
      {
        id: "series-recurrentes",
        titulo: "Series de citas recurrentes",
        descripcion: "Ortodoncia, controles y tratamientos multi-fase agendados de una sola vez.",
        roles: ["owner", "receptionist", "doctor"],
        pasos: [
          "Abre Negocios → Series y pulsa Nueva serie.",
          "Elige paciente, servicio, doctor, día y hora base, y la frecuencia: semanal, quincenal o mensual.",
          "Indica cuántas repeticiones quieres; la app genera todas las citas juntas respetando los turnos del doctor.",
          "Si el tratamiento cambia, usa Cancelar serie: se cancelan las citas futuras pendientes en bloque (las ya atendidas quedan intactas).",
        ],
        tip: "Las series reservan la misma franja horaria en cada repetición: crea la serie apenas el paciente acepte el plan para asegurar su horario preferido.",
      },
      {
        id: "referidos",
        titulo: "Referidos entre pacientes con tracking",
        descripcion: "Cada paciente tiene un código propio; gana atribución cuando trae a alguien nuevo.",
        roles: ["owner", "receptionist"],
        pasos: [
          "En la ficha de cada paciente usa Compartir link de referido: copia o envía su enlace único (tu-dominio/clinica/reserva?ref=CODIGO).",
          "Publica ese enlace en WhatsApp, historias o tarjetas; también funciona si el paciente lo comparte boca a boca digital.",
          "Cuando alguien reserva por ese enlace y es un paciente nuevo, queda automáticamente referido por el dueño del código.",
          "Los dueños revisan el ranking en Negocios → Referidos: cuántos referidos trajo cada paciente y cuántos ya asistieron.",
        ],
        tip: "Premia a tus mejores embajadores: ordena el informe por referidos asistidos y regala una limpieza o descuento a los primeros.",
      },
      {
        id: "no-show-recuperacion",
        titulo: "Recuperación automática de no-shows",
        descripcion: "Cuando un paciente no llega, la app le ofrece reagendar sin que muevas un dedo.",
        roles: ["owner", "receptionist"],
        pasos: [
          "Actívalo en Configuración → Notificaciones con el toggle de recuperación de no-show.",
          "Al marcar una cita como No-show, el paciente recibe automáticamente un mensaje empático con invitación a reprogramar.",
          "Si el paciente acepta y se genera una nueva cita, el sistema cuenta esa cita como recuperada.",
          "La tasa de recuperación aparece en tu panel: cuántos no-shows volvieron a agenda.",
        ],
        tip: "Un no-show contactado a tiempo vuelve hasta 3 de cada 10 veces: deja el toggle activo y revisa la métrica cada mes.",
      },
      {
        id: "produccion-doctor",
        titulo: "Producción por doctor",
        descripcion: "Cuánto produce cada odontólogo por periodo: citas atendidas, pagos y ticket promedio.",
        roles: ["owner"],
        pasos: [
          "Abre Negocios → Producción y elige el periodo (esta semana, este mes o rango personalizado).",
          "Compara doctores por citas atendidas, producción cobrada y ticket promedio.",
          "Entra al detalle de cada doctor para ver qué servicios generaron su producción en el periodo.",
          "Úsalo para balancear la carga de agenda: igualar pacientes por doctor evita saturar a uno mientras otro tiene huecos.",
        ],
        tip: "Revisa producción semanal, no solo mensual: detectas caídas a tiempo para reaccionar dentro del mismo mes.",
      },
      {
        id: "digest-matutino",
        titulo: "Digest matutino para el dueño",
        descripcion: "Un correo al despertar: agenda del día, pacientes dormidos y huecos por llenar.",
        roles: ["owner"],
        pasos: [
          "Cada mañana recibes en tu correo de dueño el resumen del día sin abrir la app.",
          "Incluye las citas del día con horarios para preparar el consultorio.",
          "Te avisa cuántos pacientes dormidos hay pendientes de recall, con acceso directo al módulo.",
          "Muestra los huecos libres de las próximas 2 semanas para que llames y los llenes.",
        ],
        tip: "El hueco libre es inventario perecedero: si el digest muestra varios, dedica 10 minutos a llamar a la lista de espera antes del mediodía.",
      },
      {
        id: "lista-espera",
        titulo: "Lista de espera inteligente",
        descripcion: "Pacientes en cola que reciben el hueco apenas alguien cancela.",
        roles: ["owner", "receptionist"],
        pasos: [
          "Cuando un paciente quiere fecha más próxima, agrégalo desde Lista de espera con servicio y disponibilidad preferida.",
          "Al liberarse un cupo (cancelación), consulta la cola y ofrece el hueco al primer candidato compatible.",
          "Al confirmarlo, registra la cita normal: la app mueve al paciente de la cola a la agenda.",
        ],
        tip: "Combínala con el digest matutino: huecos detectados temprano + cola lista = agenda llena.",
      },
      {
        id: "inventario",
        titulo: "Inventario e insumos",
        descripcion: "Stock de insumos con recetas por servicio y movimientos trazables.",
        roles: ["owner", "assistant"],
        pasos: [
          "Registra tus insumos con stock mínimo; la página marca lo que está por debajo del mínimo.",
          "Define recetas: cuánto insumo consume cada servicio (ej. una limpieza usa X guantes y Y profilaxis).",
          "Registra entradas (compras) y salidas (consumo) para mantener el stock real.",
          "El asistente puede gestionar inventario sin acceso a caja ni ingresos.",
        ],
        tip: "Configura el stock mínimo según tu consumo semanal: así compras justo a tiempo y no atas dinero en almacén.",
      },
    ],
  },
];

export function guiasParaRol(rol: StaffRole): GuiaSeccion[] {
  return GUIAS.map((seccion) => ({
    ...seccion,
    guias: seccion.guias.filter((g) => g.roles.includes(rol)),
  })).filter((seccion) => seccion.guias.length > 0);
}
