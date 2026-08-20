import { NextResponse } from "next/server";
import { getDb, infraBackups } from "@odontoflow/db";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const KINDS = ["pg_dump", "adjuntos", "fiscal", "rclone"];

function bearerValido(req: Request): boolean {
  const esperado = process.env.CRON_SECRET;
  if (!esperado) return false;
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${esperado}`;
}

export async function POST(req: Request) {
  if (!bearerValido(req)) {
    return NextResponse.json({ error: "no_autorizado" }, { status: 401 });
  }
  if (!rateLimit("backup-log:global", 60).allowed) {
    return NextResponse.json({ ok: true, omitido: "rate_limit" });
  }

  let body: {
    kind?: unknown;
    status?: unknown;
    sizeBytes?: unknown;
    detail?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const kind = typeof body.kind === "string" ? body.kind : undefined;
  const status = typeof body.status === "string" ? body.status : undefined;
  if (!kind || !KINDS.includes(kind)) {
    return NextResponse.json({ error: "kind_invalido" }, { status: 400 });
  }
  if (!status || !["ok", "error", "omitido"].includes(status)) {
    return NextResponse.json({ error: "status_invalido" }, { status: 400 });
  }

  const sizeBytes =
    typeof body.sizeBytes === "number" && Number.isFinite(body.sizeBytes)
      ? Math.floor(body.sizeBytes)
      : null;
  const detail = typeof body.detail === "string" ? body.detail.slice(0, 500) : null;

  await getDb().insert(infraBackups).values({ kind, status, sizeBytes, detail });
  return NextResponse.json({ ok: true });
}
