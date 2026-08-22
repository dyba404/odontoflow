"use client";

import { useEffect } from "react";
import { toast } from "sonner";

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;

    let refrescando = false;

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refrescando) return;
      refrescando = true;
      window.location.reload();
    });

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        registration.addEventListener("updatefound", () => {
          const nueva = registration.installing;
          if (!nueva) return;
          nueva.addEventListener("statechange", () => {
            if (nueva.state === "installed" && navigator.serviceWorker.controller) {
              toast.info("Nueva versión disponible", {
                description: "Recarga para usar la versión más reciente de Odontoflow.",
                duration: Infinity,
                closeButton: true,
                action: {
                  label: "Recargar",
                  onClick: () => nueva.postMessage({ type: "SKIP_WAITING" }),
                },
              });
            }
          });
        });
      })
      .catch(() => {});
  }, []);

  return null;
}
