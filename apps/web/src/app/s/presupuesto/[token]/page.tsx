import { PresupuestoPublico } from "./presupuesto-publico";

export const dynamic = "force-dynamic";

export default async function PaginaPresupuestoPublico({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <PresupuestoPublico token={token} />;
}
