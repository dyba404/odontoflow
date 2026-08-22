"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CopiarLinkReferido({ url }: { url: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      toast.success("Link de referido copiado");
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast.error("No se pudo copiar el link");
    }
  }

  return (
    <Button variant="ghost" size="sm" onClick={copiar}>
      {copiado ? <Check className="size-4 text-green-600" /> : <Copy className="size-4" />}
      {copiado ? "Copiado" : "Copiar link"}
    </Button>
  );
}
