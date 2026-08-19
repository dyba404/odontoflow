"use client";

import { useRouter } from "next/navigation";

// Next 15.5 (>= 15.5.x) tiene un bug del router con navegaciones que cambian
// SOLO searchParams: la entrada "optimista" de cache reutiliza el
// renderedSearch/canonicalUrl de la primera navegacion del mismo pathname y
// re-reproduce esa URL (ver requestOptimisticRouteCacheEntry en
// segment-cache-impl). Se mitiga aqui con tres capas:
//   1) router.prefetch(url)   -> crea una entrada de ruta EXACTA para la URL
//   2) router.push(url)       -> navegacion SPA usando esa entrada si existe
//   3) fallback location.assign -> si a los 500ms la URL sigue IGUAL a la del
//      click (el push quedo en cola detras de un prefetch colgado, o la
//      entrada optimista envenenada re-reprodujo la misma URL) y ademas no
//      hubo mas de un history.pushState en el medio, se fuerza navegacion
//      completa, que siempre funciona.
//
// El conteo de pushState distingue los escenarios: un push exitoso cambia la
// URL (se descarta por la primera condicion); un push envenenado/colgado deja
// la URL intacta con 0-1 pushState (dispara el fallback); varias navegaciones
// rapidas (ej. tabs) suman >=2 pushState y no deben disparar nada, aunque la
// URL termine igual que al inicio (p.ej. Semana -> Mes -> Semana).
let contadorPushState = 0;
let parcheado = false;

export function useNavegar() {
  const router = useRouter();
  return (url: string) => {
    const antes = window.location.href;
    const destino = new URL(url, antes);
    if (!parcheado) {
      parcheado = true;
      const original = window.history.pushState.bind(window.history);
      window.history.pushState = ((data: unknown, unused: string, url?: string | URL | null) => {
        contadorPushState += 1;
        original(data, unused, url);
      }) as typeof window.history.pushState;
    }
    const base = contadorPushState;
    try {
      router.prefetch(url);
    } catch {
      // prefetch es opcional; si falla, la navegacion push/fallback cubre.
    }
    router.push(url);
    window.setTimeout(() => {
      if (window.location.href === antes && contadorPushState - base <= 1) {
        window.location.assign(destino.href);
      }
    }, 500);
  };
}