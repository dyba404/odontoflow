import { statSync } from "node:fs";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/** Raíz local de adjuntos (alberga también `fiscal/`). */
export function attachmentsRoot(): string {
  const base = process.env.ATTACHMENTS_DIR ?? join(process.cwd(), ".data", "attachments");
  return resolve(base);
}

export type StorageDriverName = "local" | "s3";

export interface Storage {
  readonly driver: StorageDriverName;
  /**
   * Escribe `data` en `key`.
   * - local: `key` es una ruta absoluta bajo `attachmentsRoot()`.
   * - s3:    `key` es la object key dentro del bucket.
   */
  put(key: string, data: Uint8Array | Readable, mime: string, size?: number): Promise<void>;
  get(key: string): Promise<Uint8Array>;
  delete(key: string): Promise<void>;
  /** URL firmada de descarga, o `null` si el driver no lo soporta. */
  signGetUrl(key: string, expiresInSec: number): Promise<string | null>;
  /** URL firmada de subida, o `null` si el driver no lo soporta. */
  signPutUrl(key: string, mime: string, expiresInSec: number): Promise<string | null>;
  head(key: string): Promise<{ size: number } | null>;
}

/**
 * Driver local (default, activo desde siempre). `key` = ruta absoluta real
 * (mismo valor que `attachments.storage_path`).
 */
class LocalStorageDriver implements Storage {
  readonly driver = "local" as const;

  private segura(key: string, escritura: boolean): string {
    const raiz = resolve(attachmentsRoot());
    const abs = resolve(key);
    if (escritura && !abs.startsWith(`${raiz}${sep}`) && abs !== raiz) {
      throw new Error("ruta_invalida");
    }
    return abs;
  }

  async put(key: string, data: Uint8Array | Readable, _mime: string, _size?: number): Promise<void> {
    const destino = this.segura(key, true);
    await mkdir(dirname(destino), { recursive: true });
    if (data instanceof Uint8Array) {
      await writeFile(destino, data);
      return;
    }
    const chunks: Buffer[] = [];
    for await (const c of data) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
    await writeFile(destino, Buffer.concat(chunks));
  }

  async get(key: string): Promise<Uint8Array> {
    try {
      return new Uint8Array(await readFile(this.segura(key, false)));
    } catch {
      throw Object.assign(new Error("archivo_no_existente"), { code: "ENOENT" });
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(this.segura(key, false));
    } catch {
      return;
    }
  }

  async signGetUrl(_key: string, _expiresInSec: number): Promise<string | null> {
    return null;
  }

  async signPutUrl(_key: string, _mime: string, _expiresInSec: number): Promise<string | null> {
    return null;
  }

  async head(key: string): Promise<{ size: number } | null> {
    try {
      const st = statSync(this.segura(key, false));
      if (!st.isFile()) return null;
      return { size: st.size };
    } catch {
      return null;
    }
  }
}

/**
 * Driver S3 (compatible R2/S3). `key` = object key dentro del bucket.
 * Solo se activa con `STORAGE_DRIVER=s3` + credenciales; no se activa durante
 * el buildeo (costo $0 hasta ~50 clínicas). Sin endpoint/credenciales lanza
 * error inmediato para no degradar silenciosamente a local.
 */
class S3StorageDriver implements Storage {
  readonly driver = "s3" as const;
  private client: S3Client;
  private bucket: string;
  private baseUrl: string | null;

  constructor() {
    const endpoint = process.env.S3_ENDPOINT ?? "";
    if (!endpoint) {
      throw new Error("S3_ENDPOINT no configurado (STORAGE_DRIVER=s3 requiere endpoint)");
    }
    this.bucket = process.env.S3_BUCKET ?? "";
    if (!this.bucket) {
      throw new Error("S3_BUCKET no configurado");
    }
    this.baseUrl = process.env.S3_PUBLIC_BASE_URL ?? null;
    this.client = new S3Client({
      region: process.env.S3_REGION ?? "auto",
      endpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
      },
    });
  }

  async put(key: string, data: Uint8Array | Readable, mime: string, size?: number): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: data,
        ContentType: mime,
        ContentLength: size,
      }),
    );
  }

  async get(key: string): Promise<Uint8Array> {
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    const bytes = await res.Body?.transformToByteArray?.();
    return new Uint8Array(bytes ?? []);
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  async signGetUrl(key: string, expiresInSec: number): Promise<string | null> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: expiresInSec },
    );
  }

  async signPutUrl(key: string, mime: string, expiresInSec: number): Promise<string | null> {
    return getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: mime,
      }),
      { expiresIn: expiresInSec },
    );
  }

  async head(key: string): Promise<{ size: number } | null> {
    try {
      const res = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return { size: res.ContentLength ?? 0 };
    } catch {
      return null;
    }
  }

  /** URL pública directa (solo si el bucket lo permite); si no → presigned. */
  async publicUrl(key: string, expiresInSec: number): Promise<string | null> {
    if (this.baseUrl) return `${this.baseUrl.replace(/\/$/, "")}/${key}`;
    return this.signGetUrl(key, expiresInSec);
  }
}

const localSingleton: Storage = new LocalStorageDriver();
let s3Singleton: Storage | null = null;

// We expose classes for unit testing and use (via instanceof). The runtime
// uses singletons only through localStorage() / getStorage().
export { LocalStorageDriver, S3StorageDriver };

/** Driver local (singleton). */
export function localStorage(): Storage {
  return localSingleton;
}

/** Driver s3 (singleton). Lanza si falta configuración. */
export function s3Storage(): Storage {
  if (!s3Singleton) s3Singleton = new S3StorageDriver();
  return s3Singleton;
}

/** Driver activo para NUEVAS escrituras según `STORAGE_DRIVER` (default local). */
export function getStorage(): Storage {
  const driver = process.env.STORAGE_DRIVER as StorageDriverName | undefined;
  if (driver !== "s3") return localStorage();
  return s3Storage();
}

/**
 * Driver que posee un objeto existente según `attachments.storage`.
 * Útil para servir filas migradas gradualmente (locales + s3 conviviendo).
 */
export function storagePara(storage: string | null | undefined): Storage {
  return storage === "s3" ? s3Storage() : localStorage();
}
