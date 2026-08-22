import { getSession } from "@/lib/auth";
import { suscribirEventos, type EventoConsola } from "@/lib/eventos";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEARTBEAT_MS = 25_000;

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return new Response("unauthorized", { status: 401 });
  const teamId = session.teamId;

  const encoder = new TextEncoder();
  let limpiar: (() => void) | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const enviar = (bloque: string) => {
        try {
          controller.enqueue(encoder.encode(bloque));
        } catch {
          limpiar?.();
        }
      };

      enviar("retry: 3000\n\n");

      const alEvento = (ev: EventoConsola) => {
        if (ev.teamId !== teamId) return;
        enviar(`data: ${JSON.stringify({ tipo: ev.tipo })}\n\n`);
      };
      const desuscribir = suscribirEventos(alEvento);

      const heartbeat = setInterval(() => enviar(":ping\n\n"), HEARTBEAT_MS);

      limpiar = () => {
        clearInterval(heartbeat);
        desuscribir();
        try {
          controller.close();
        } catch {
          /* ya cerrado */
        }
      };

      req.signal.addEventListener("abort", () => limpiar?.());
    },
    cancel() {
      limpiar?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
