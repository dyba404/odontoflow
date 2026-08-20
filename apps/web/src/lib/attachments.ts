import { join, resolve } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

export function attachmentsRoot(): string {
  const base = process.env.ATTACHMENTS_DIR ?? join(process.cwd(), ".data", "attachments");
  return resolve(base);
}

// Derivados de imágenes: thumb (lista/móvil) y preview (visor). Se generan
// en upload junto al original; variantes = rutas hermanas con sufijo.
export const VARIANTES = ["thumb", "preview"] as const;
export type VarianteImg = (typeof VARIANTES)[number];

export const MIME_FOTO = ["image/jpeg", "image/png", "image/webp"];

export function variantesDe(ruta: string): Record<VarianteImg, string> {
  return {
    thumb: `${ruta}.thumb.webp`,
    preview: `${ruta}.preview.webp`,
  };
}

// Genera thumb + preview de un buffer de imagen. Nunca falla el upload si
// sharp no puede procesar (p. ej. formato exótico): se devuelven null y el
// servido hace fallback al original.
export async function generarVariantes(
  buffer: Buffer,
  filePath: string,
): Promise<boolean> {
  try {
    const sharp = (await import("sharp")).default;
    const rutas = variantesDe(filePath);
    await mkdir(dirDe(rutas.thumb), { recursive: true });
    const [thumb, preview] = await Promise.all([
      sharp(buffer).rotate().resize({ width: 256, height: 256, fit: "inside" }).webp({ quality: 78 }).toBuffer(),
      sharp(buffer).rotate().resize({ width: 1600, height: 1600, fit: "inside" }).webp({ quality: 82 }).toBuffer(),
    ]);
    await Promise.all([
      writeFile(rutas.thumb, thumb),
      writeFile(rutas.preview, preview),
    ]);
    return true;
  } catch {
    return false;
  }
}

function dirDe(ruta: string): string {
  const idx = Math.max(ruta.lastIndexOf("/"), ruta.lastIndexOf("\\"));
  return idx > 0 ? ruta.slice(0, idx) : ".";
}
