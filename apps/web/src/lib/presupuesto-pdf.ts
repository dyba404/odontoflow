import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type ItemPresupuestoPdf = {
  descripcion?: string;
  cantidad?: number;
  precioUnitario?: number;
};

/**
 * PDF del presupuesto aceptado (visión §2.2(6)).
 * El SHA-256 de estos bytes se guarda en `budget_signatures.document_hash`
 * como evidencia anti-tamper: cualquier alteración posterior del documento
 * rompe el hash.
 */
export async function pdfPresupuestoFirmado(opts: {
  clinicaNombre: string;
  titulo: string;
  items: ItemPresupuestoPdf[];
  total: number;
  expiraEn: string | null;
  firmanteNombre: string;
  firmanteRol: "paciente" | "tutor";
  signaturePng: Buffer;
  signedAt: Date;
  ipHash: string;
  userAgent: string | null;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const teal = rgb(13 / 255, 148 / 255, 136 / 255);

  page.drawText(opts.clinicaNombre, { x: 48, y: 794, size: 11, font, color: rgb(0.45, 0.45, 0.45) });
  page.drawText("Aceptación de presupuesto", { x: 48, y: 760, size: 20, font: fontBold });
  page.drawText("Odontoflow", { x: 48, y: 744, size: 10, font, color: teal });

  let y = 700;
  const lineas: string[] = [
    `Presupuesto: ${opts.titulo}`,
    opts.expiraEn ? `Válido hasta: ${opts.expiraEn}` : "",
    "",
    "Detalle:",
  ];
  for (const it of opts.items) {
    const cant = it.cantidad ?? 1;
    const precio = Number(it.precioUnitario ?? 0);
    lineas.push(`  - ${it.descripcion ?? "Tratamiento"} x${cant}: S/ ${(cant * precio).toFixed(2)}`);
  }
  lineas.push("", `Total: S/ ${opts.total.toFixed(2)}`, "");

  for (const linea of lineas) {
    if (!linea) {
      y -= 8;
      continue;
    }
    const maxChars = 95;
    for (let i = 0; i < linea.length; i += maxChars) {
      page.drawText(linea.slice(i, i + maxChars), { x: 48, y, size: 11, font });
      y -= 16;
    }
  }

  y -= 8;
  page.drawText("Firma de aceptación:", { x: 48, y, size: 11, font: fontBold });
  y -= 12;

  const firmaPng = await pdf.embedPng(opts.signaturePng);
  const escala = Math.min(200 / firmaPng.width, 60 / firmaPng.height);
  page.drawImage(firmaPng, {
    x: 48,
    y: y - firmaPng.height * escala,
    width: firmaPng.width * escala,
    height: firmaPng.height * escala,
  });
  y -= 90;

  page.drawLine({
    start: { x: 48, y },
    end: { x: 260, y },
    thickness: 0.75,
    color: rgb(0, 0, 0),
  });
  y -= 14;

  const rolLabel = opts.firmanteRol === "tutor" ? "Tutor/representante" : "Paciente";
  page.drawText(`${opts.firmanteNombre} — ${rolLabel}, firmado digitalmente`, {
    x: 48,
    y,
    size: 9,
    font,
  });
  const fechaFirma = new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    dateStyle: "long",
    timeStyle: "short",
  }).format(opts.signedAt);
  page.drawText(`Fecha de firma: ${fechaFirma}`, { x: 48, y: y - 12, size: 9, font, color: rgb(0.45, 0.45, 0.45) });
  page.drawText(`Evidencia IP (hash): ${opts.ipHash.slice(0, 32)}…`, {
    x: 48,
    y: y - 24,
    size: 8,
    font,
    color: rgb(0.45, 0.45, 0.45),
  });
  if (opts.userAgent) {
    page.drawText(`Equipo: ${opts.userAgent.slice(0, 90)}`, {
      x: 48,
      y: y - 36,
      size: 8,
      font,
      color: rgb(0.45, 0.45, 0.45),
    });
  }

  return pdf.save();
}
