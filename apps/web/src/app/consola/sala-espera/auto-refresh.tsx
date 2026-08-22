"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";

const FALLBACK_MS = 30_000;

export function AutoRefresh({ children }: { children: ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    let fallbackId: ReturnType<typeof setInterval> | null = null;
    let fuente: EventSource | null = null;
    let desechado = false;

    const arrancarFallback = () => {
      if (fallbackId === null) {
        fallbackId = setInterval(() => router.refresh(), FALLBACK_MS);
      }
    };
    const pararFallback = () => {
      if (fallbackId !== null) {
        clearInterval(fallbackId);
        fallbackId = null;
      }
    };
    const abrirSse = () => {
      if (fuente || desechado) return;
      fuente = new EventSource("/api/sala/eventos");
      fuente.onmessage = () => router.refresh();
    };
    const cerrarSse = () => {
      fuente?.close();
      fuente = null;
    };

    const alCambiarVisibilidad = () => {
      if (document.hidden) {
        pararFallback();
        cerrarSse();
      } else {
        router.refresh();
        abrirSse();
        arrancarFallback();
      }
    };

    abrirSse();
    arrancarFallback();
    document.addEventListener("visibilitychange", alCambiarVisibilidad);
    return () => {
      desechado = true;
      pararFallback();
      cerrarSse();
      document.removeEventListener("visibilitychange", alCambiarVisibilidad);
    };
  }, [router]);

  return <>{children}</>;
}
