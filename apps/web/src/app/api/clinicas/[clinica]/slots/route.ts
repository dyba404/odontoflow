import { NextResponse } from "next/server";
import { computeSlots } from "@/lib/db";
import { getTenantBySlug, listDoctors } from "@/lib/db";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ clinica: string }> },
) {
  const { clinica } = await params;
  const url = new URL(req.url);
  const serviceId = url.searchParams.get("serviceId");
  const date = url.searchParams.get("date");
  const doctorMembershipId = url.searchParams.get("doctorId");

  if (!serviceId || !date) {
    return NextResponse.json({ error: "faltan_parametros" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "fecha_invalida" }, { status: 400 });
  }

  const tenant = await getTenantBySlug(clinica);
  if (!tenant) {
    return NextResponse.json({ error: "clinica_no_encontrada" }, { status: 404 });
  }

  const doctores = await listDoctors(tenant.teamId);
  const slotData = await computeSlots(tenant.teamId, {
    serviceId,
    date,
    doctorMembershipId: doctorMembershipId || null,
  });
  if (!slotData) {
    return NextResponse.json({ error: "servicio_invalido" }, { status: 400 });
  }

  return NextResponse.json({
    date,
    slots: slotData.slots,
    doctores,
  });
}
