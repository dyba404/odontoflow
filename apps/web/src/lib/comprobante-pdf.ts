import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export interface ComprobantePdfDatos {
  tipo: string;
  serie: string;
  correlativo: number;
  sunatEstado: string;
  sunatHash: string | null;
  emitidaAt: Date | string | null;
  createdAt: Date | string;
  monto: number;
  metodo: string;
  referencia: string | null;
  razonSocial: string;
  ruc: string | null;
  clienteNombre: string | null;
  clienteDocumento: string | null;
  afectadoNumero: string | null;
  bajaMotivo: string | null;
  teamName: string;
  timezone: string;
}

const TIPO_TITULO: Record<string, string> = {
  boleta: "BOLETA ELECTRÓNICA",
  factura: "FACTURA ELECTRÓNICA",
  nota_credito: "NOTA DE CRÉDITO",
  nota_debito: "NOTA DE DÉBITO",
};

const ESTADO_LABEL: Record<string, string> = {
  manual: "Manual",
  pendiente_envio: "Pendiente de envío",
  aceptado: "Aceptado por SUNAT",
  rechazado: "Rechazado por SUNAT",
  baja: "De baja",
  baja_pendiente: "Baja enviada",
  baja_aceptada: "Comprobante de baja (anulado)",
  baja_rechazada: "Baja rechazada",
};

const METODO_LABEL: Record<string, string> = {
  yape: "Yape",
  plin: "Plin",
  efectivo: "Efectivo",
  tarjeta_pos: "Tarjeta POS",
  tarjeta_online: "Tarjeta online",
  otro: "Otro",
};

function fechaTexto(d: Date | string, timezone: string): string {
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  }).format(typeof d === "string" ? new Date(d) : d);
}

function soles(n: number): string {
  return `S/ ${n.toFixed(2)}`;
}

export async function generarPdfComprobante(d: ComprobantePdfDatos): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const teal = rgb(13 / 255, 148 / 255, 136 / 255);
  const gris = rgb(0.45, 0.45, 0.45);
  const negro = rgb(0, 0, 0);

  const numero = `${d.serie}-${String(d.correlativo).padStart(8, "0")}`;
  const titulo = TIPO_TITULO[d.tipo] ?? d.tipo.toUpperCase();
  const esNota = d.tipo === "nota_credito" || d.tipo === "nota_debito";
  const esAnulacion = d.sunatEstado === "baja_aceptada" || esNota;

  page.drawRectangle({ x: 0, y: 790, width: 595, height: 52, color: teal });
  page.drawText(d.teamName, { x: 48, y: 814, size: 16, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText("Odontoflow · comprobante electrónico", { x: 48, y: 798, size: 9, font, color: rgb(0.9, 1, 0.98) });
  page.drawText(titulo, { x: 420, y: 814, size: 11, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText(numero, { x: 420, y: 798, size: 10, font, color: rgb(1, 1, 1) });

  let y = 762;
  const linea = (texto: string, op?: { size?: number; bold?: boolean; color?: typeof negro }) => {
    page.drawText(texto, {
      x: 48,
      y,
      size: op?.size ?? 10,
      font: op?.bold ? fontBold : font,
      color: op?.color ?? negro,
    });
    y -= (op?.size ?? 10) + 6;
  };

  linea("Datos del emisor", { bold: true, color: teal });
  linea(d.razonSocial);
  if (d.ruc) linea(`RUC: ${d.ruc}`, { color: gris });
  y -= 6;

  linea("Cliente / receptor", { bold: true, color: teal });
  linea(d.clienteNombre ?? "Consumidor final");
  if (d.clienteDocumento) linea(`Documento: ${d.clienteDocumento}`, { color: gris });
  y -= 6;

  if (esNota && d.afectadoNumero) {
    linea("Comprobante modificado", { bold: true, color: teal });
    linea(d.afectadoNumero);
    if (d.bajaMotivo) linea(`Motivo: ${d.bajaMotivo}`, { color: gris });
    y -= 6;
  }

  linea("Concepto", { bold: true, color: teal });
  const concepto = esAnulacion
    ? `Anulación del comprobante ${d.afectadoNumero ?? numero}`
    : `Servicio odontológico - ${numero}`;
  const maxChars = 92;
  if (concepto.length > maxChars) {
    for (let i = 0; i < concepto.length; i += maxChars) {
      linea(concepto.slice(i, i + maxChars));
    }
  } else {
    linea(concepto);
  }
  y -= 10;

  const monto = Math.round(d.monto * 100) / 100;
  const valor = Math.round((monto / 1.18) * 100) / 100;
  const igv = Math.round((monto - valor) * 100) / 100;

  page.drawLine({ start: { x: 48, y: y + 2 }, end: { x: 547, y: y + 2 }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) });
  y -= 12;
  const montoLinea = (label: string, val: string, bold = false) => {
    page.drawText(label, { x: 380, y, size: 10, font: bold ? fontBold : font, color: bold ? negro : gris });
    page.drawText(val, { x: 547 - font.widthOfTextAtSize(val, 10), y, size: 10, font: bold ? fontBold : font });
    y -= 16;
  };
  montoLinea("Valor venta", esAnulacion ? `(${soles(valor)})` : soles(valor));
  montoLinea("IGV (18%)", esAnulacion ? `(${soles(igv)})` : soles(igv));
  page.drawLine({ start: { x: 380, y: y + 4 }, end: { x: 547, y: y + 4 }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) });
  y -= 12;
  montoLinea("Importe total", esAnulacion ? `(${soles(monto)})` : soles(monto), true);
  y -= 20;

  linea("Estado SUNAT", { bold: true, color: teal });
  linea(ESTADO_LABEL[d.sunatEstado] ?? d.sunatEstado, { color: d.sunatEstado === "aceptado" ? teal : negro });
  if (d.emitidaAt) linea(`Emisión: ${fechaTexto(d.emitidaAt, d.timezone)}`, { color: gris });
  if (d.sunatHash) linea(`Hash CDR: ${d.sunatHash}`, { color: gris, size: 8 });
  linea(`Medio de pago: ${METODO_LABEL[d.metodo] ?? d.metodo}`, { color: gris });
  if (d.referencia) linea(`Referencia: ${d.referencia}`, { color: gris });
  if (d.sunatEstado === "baja_aceptada" && d.bajaMotivo && !esNota) {
    linea(`Dado de baja por: ${d.bajaMotivo}`, { color: gris });
  }

  page.drawText(
    "Documento generado electrónicamente por Odontoflow. Válido para presentarlo ante SUNAT según su estado.",
    { x: 48, y: 52, size: 8, font, color: gris, maxWidth: 500 },
  );
  page.drawText(`Generado el ${fechaTexto(new Date(), d.timezone)}`, { x: 48, y: 38, size: 8, font, color: gris });

  return pdf.save();
}
